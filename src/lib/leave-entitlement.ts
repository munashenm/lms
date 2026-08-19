import { LeaveStatus, type LeavePolicy } from "@prisma/client";
import { prisma } from "./db";
import { roundMoney } from "./money";
import { accruedDaysFor, remainingLeaveDays } from "./leave-balance";

export { accruedDaysFor, remainingLeaveDays, unpaidLeaveDoesNotConsume } from "./leave-balance";
export type { LeaveBalanceParts } from "./leave-balance";

export async function ensureLeaveEntitlement(params: {
  employeeId: string;
  policy: Pick<LeavePolicy, "id" | "daysPerYear" | "accrualMethod">;
  cycleYear: number;
  asOf: Date;
}) {
  const accrued = accruedDaysFor({
    daysPerYear: Number(params.policy.daysPerYear),
    method: params.policy.accrualMethod,
    cycleYear: params.cycleYear,
    asOf: params.asOf,
  });
  const existing = await prisma.leaveEntitlement.findUnique({
    where: {
      employeeId_leavePolicyId_cycleYear: {
        employeeId: params.employeeId,
        leavePolicyId: params.policy.id,
        cycleYear: params.cycleYear,
      },
    },
  });
  if (!existing) {
    return prisma.leaveEntitlement.create({
      data: {
        employeeId: params.employeeId,
        leavePolicyId: params.policy.id,
        cycleYear: params.cycleYear,
        accrued,
      },
    });
  }
  if (Number(existing.accrued) !== accrued) {
    return prisma.leaveEntitlement.update({
      where: { id: existing.id },
      data: { accrued },
    });
  }
  return existing;
}

export async function assertLeaveBalance(params: {
  employeeId: string;
  policy: Pick<LeavePolicy, "id" | "daysPerYear" | "accrualMethod" | "name">;
  days: number;
  asOf: Date;
}) {
  const cycleYear = params.asOf.getUTCFullYear();
  const row = await ensureLeaveEntitlement({
    employeeId: params.employeeId,
    policy: params.policy,
    cycleYear,
    asOf: params.asOf,
  });
  const remaining = remainingLeaveDays({
    openingBalance: Number(row.openingBalance),
    accrued: Number(row.accrued),
    taken: Number(row.taken),
  });
  if (remaining + 1e-9 < params.days) {
    throw new Error(
      `Insufficient ${params.policy.name} balance (${remaining} day(s) remaining, ${params.days} requested)`
    );
  }
  return row;
}

export async function applyLeaveTaken(params: {
  employeeId: string;
  leavePolicyId: string;
  days: number;
  asOf: Date;
  reverse?: boolean;
}) {
  const cycleYear = params.asOf.getUTCFullYear();
  const existing = await prisma.leaveEntitlement.findUnique({
    where: {
      employeeId_leavePolicyId_cycleYear: {
        employeeId: params.employeeId,
        leavePolicyId: params.leavePolicyId,
        cycleYear,
      },
    },
  });
  if (!existing) return null;
  const delta = params.reverse ? -Number(params.days) : Number(params.days);
  const nextTaken = roundMoney(Math.max(0, Number(existing.taken) + delta));
  return prisma.leaveEntitlement.update({
    where: { id: existing.id },
    data: { taken: nextTaken },
  });
}

export async function accrueSchoolLeaveEntitlements(params: {
  schoolId: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const cycleYear = asOf.getUTCFullYear();
  const [employees, policies] = await Promise.all([
    prisma.employee.findMany({
      where: { schoolId: params.schoolId, status: { not: "TERMINATED" } },
      select: { id: true },
    }),
    prisma.leavePolicy.findMany({
      where: { schoolId: params.schoolId, isActive: true },
    }),
  ]);
  let updated = 0;
  for (const employee of employees) {
    for (const policy of policies) {
      await ensureLeaveEntitlement({
        employeeId: employee.id,
        policy,
        cycleYear,
        asOf,
      });
      updated += 1;
    }
  }
  return { employees: employees.length, policies: policies.length, entitlements: updated };
}

export async function ensureEmployeeLeaveEntitlements(params: {
  schoolId: string;
  employeeId: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const cycleYear = asOf.getUTCFullYear();
  const policies = await prisma.leavePolicy.findMany({
    where: { schoolId: params.schoolId, isActive: true },
  });
  for (const policy of policies) {
    await ensureLeaveEntitlement({
      employeeId: params.employeeId,
      policy,
      cycleYear,
      asOf,
    });
  }
  return { policies: policies.length };
}

export async function syncLeaveTakenOnStatusChange(params: {
  previousStatus: LeaveStatus;
  nextStatus: LeaveStatus;
  employeeId: string | null;
  leavePolicyId: string | null;
  days: number;
  startDate: Date;
}) {
  if (!params.employeeId || !params.leavePolicyId) return;
  const wasApproved = params.previousStatus === LeaveStatus.APPROVED;
  const nowApproved = params.nextStatus === LeaveStatus.APPROVED;
  if (!wasApproved && nowApproved) {
    await applyLeaveTaken({
      employeeId: params.employeeId,
      leavePolicyId: params.leavePolicyId,
      days: params.days,
      asOf: params.startDate,
    });
  } else if (wasApproved && !nowApproved) {
    await applyLeaveTaken({
      employeeId: params.employeeId,
      leavePolicyId: params.leavePolicyId,
      days: params.days,
      asOf: params.startDate,
      reverse: true,
    });
  }
}
