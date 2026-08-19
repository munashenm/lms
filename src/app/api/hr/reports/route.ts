import { NextResponse } from "next/server";
import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const filter = getSchoolFilter(session!);
  const now = new Date();
  const [employees, runs, leave, entitlements] = await Promise.all([
    prisma.employee.findMany({ where: filter, select: { status: true, campusId: true, department: true, employmentType: true, endDate: true, startDate: true } }),
    prisma.payrollRun.findMany({ where: filter, orderBy: { periodStart: "desc" }, take: 12 }),
    prisma.leaveRequest.findMany({
      where: { ...filter, status: LeaveStatus.APPROVED, startDate: { lte: now }, endDate: { gte: now } },
    }),
    prisma.leaveEntitlement.findMany({
      where: { employee: filter },
      include: { leavePolicy: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    }),
  ]);

  const byDepartment: Record<string, number> = {};
  const byCampus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const e of employees) {
    const dept = e.department || "Unassigned";
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    const campus = e.campusId || "Unassigned";
    byCampus[campus] = (byCampus[campus] ?? 0) + 1;
    byType[e.employmentType] = (byType[e.employmentType] ?? 0) + 1;
  }

  const expiringContracts = employees.filter((e) => e.endDate && e.endDate > now && e.endDate.getTime() - now.getTime() < 90 * 86400000);

  return NextResponse.json({
    headcount: employees.filter((e) => e.status !== "TERMINATED").length,
    byDepartment,
    byCampus,
    byType,
    onLeave: leave.length,
    contractExpiry: expiringContracts.length,
    payrollTotals: runs.map((r) => ({
      id: r.id,
      periodStart: r.periodStart,
      status: r.status,
      totalNet: Number(r.totalNet),
      totalGross: Number(r.totalGross),
    })),
    leaveBalances: entitlements.map((row) => ({
      employee: `${row.employee.firstName} ${row.employee.lastName}`,
      employeeNumber: row.employee.employeeNumber,
      policy: row.leavePolicy.name,
      remaining: Number(row.openingBalance) + Number(row.accrued) - Number(row.taken),
    })),
  });
}
