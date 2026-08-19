import {
  ApprovalStatus,
  LedgerEntryType,
  PayrollRunStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { calculateEmployeePay, parsePayrollRules } from "./payroll-engine";
import { nextPayslipNumber } from "./finance-catalog";
import { logAudit } from "./audit";
import { addMoney } from "./money";
import { asInputJson } from "./json";
import { sumTimesheetHours } from "./timesheet-hours";

function asAllowances(json: unknown): Array<{ name: string; amount: number }> {
  if (!Array.isArray(json)) return [];
  return json
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as { name?: string; amount?: number };
      if (!rec.name || !rec.amount) return null;
      return { name: String(rec.name), amount: Number(rec.amount) };
    })
    .filter((row): row is { name: string; amount: number } => Boolean(row));
}

export async function calculatePayrollRun(params: {
  runId: string;
  schoolId: string;
  actorId?: string | null;
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.runId, schoolId: params.schoolId },
    include: { ruleSet: true },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status === PayrollRunStatus.FINALISED) throw new Error("Finalised payroll cannot be recalculated");

  const employees = await prisma.employee.findMany({
    where: { schoolId: params.schoolId, status: { not: "TERMINATED" } },
    include: {
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
    },
  });

  const rules = parsePayrollRules(run.ruleSet?.rulesJson);
  await prisma.payrollItem.deleteMany({ where: { payrollRunId: run.id } });

  let totalGross = 0;
  let totalDeductions = 0;
  let totalEmployer = 0;
  let totalNet = 0;

  for (const employee of employees) {
    const salary = employee.salaryStructures.find(
      (s) => s.effectiveFrom <= run.periodEnd && (!s.effectiveTo || s.effectiveTo >= run.periodStart)
    );
    if (!salary) continue;
    const timesheets = await prisma.timesheet.findMany({
      where: {
        employeeId: employee.id,
        status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.POSTED] },
        periodStart: { lte: run.periodEnd },
        periodEnd: { gte: run.periodStart },
      },
      include: { entries: true },
    });
    const hours = sumTimesheetHours(
      timesheets.flatMap((t) =>
        t.entries.map((entry) => ({
          hours: Number(entry.hours),
          overtimeHours: Number(entry.overtimeHours),
        }))
      )
    );
    const calc = calculateEmployeePay(
      {
        payType: salary.payType,
        baseSalary: Number(salary.baseSalary),
        hourlyRate: salary.hourlyRate ? Number(salary.hourlyRate) : null,
        hoursWorked: hours.totalHours,
        overtimeHours: hours.overtimeHours,
        allowances: asAllowances(salary.allowancesJson),
      },
      rules
    );
    const exceptionNote =
      salary.payType === "HOURLY" && hours.totalHours <= 0
        ? "No approved timesheet hours in this period"
        : calc.exceptionNote ?? null;
    totalGross = addMoney(totalGross, calc.grossPay);
    totalDeductions = addMoney(totalDeductions, calc.totalDeductions);
    totalEmployer = addMoney(totalEmployer, calc.employerContributions);
    totalNet = addMoney(totalNet, calc.netPay);

    await prisma.payrollItem.create({
      data: {
        payrollRunId: run.id,
        employeeId: employee.id,
        grossPay: calc.grossPay,
        totalDeductions: calc.totalDeductions,
        employerContributions: calc.employerContributions,
        netPay: calc.netPay,
        earningsJson: asInputJson(calc.earnings),
        deductionsJson: asInputJson(calc.deductions),
        employerJson: asInputJson(calc.employer),
        exceptionNote,
      },
    });
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PayrollRunStatus.CALCULATED,
      totalGross,
      totalDeductions,
      totalEmployer,
      totalNet,
    },
    include: { items: { include: { employee: true } } },
  });

  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "PAYROLL_CALCULATED",
    entity: "PayrollRun",
    entityId: run.id,
    metadata: { employees: updated.items.length, totalNet },
  });

  return updated;
}

export async function approvePayrollRun(params: {
  runId: string;
  schoolId: string;
  actorId: string;
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.runId, schoolId: params.schoolId },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== PayrollRunStatus.CALCULATED) {
    throw new Error("Payroll must be calculated before approval");
  }
  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PayrollRunStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: params.actorId,
    },
  });
  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "PAYROLL_APPROVED",
    entity: "PayrollRun",
    entityId: run.id,
  });
  return updated;
}

export async function finalisePayrollRun(params: {
  runId: string;
  schoolId: string;
  actorId: string;
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.runId, schoolId: params.schoolId },
    include: { items: true },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== PayrollRunStatus.APPROVED) {
    throw new Error("Payroll must be approved before finalising");
  }
  if (run.postedAt) throw new Error("Payroll already posted to finance");

  for (const item of run.items) {
    const existing = await prisma.payslip.findUnique({ where: { payrollItemId: item.id } });
    if (existing) continue;
    const number = await nextPayslipNumber(params.schoolId);
    await prisma.payslip.create({
      data: { payrollItemId: item.id, number },
    });
    await logAudit({
      schoolId: params.schoolId,
      userId: params.actorId,
      action: "PAYSLIP_GENERATED",
      entity: "Payslip",
      entityId: item.id,
      metadata: { payrollRunId: run.id, number },
    });
  }

  await prisma.ledgerEntry.create({
    data: {
      schoolId: params.schoolId,
      type: LedgerEntryType.EXPENSE,
      category: "Salaries",
      description: `Payroll ${run.periodStart.toISOString().slice(0, 10)} – ${run.periodEnd.toISOString().slice(0, 10)}`,
      amount: run.totalGross,
      reference: run.id,
      entryDate: run.paymentDate ?? run.periodEnd,
      recordedById: params.actorId,
      payrollRunId: run.id,
    },
  });
  if (Number(run.totalEmployer) > 0) {
    await prisma.ledgerEntry.create({
      data: {
        schoolId: params.schoolId,
        type: LedgerEntryType.EXPENSE,
        category: "Employer contributions",
        description: `Payroll employer contributions ${run.id}`,
        amount: run.totalEmployer,
        reference: run.id,
        entryDate: run.paymentDate ?? run.periodEnd,
        recordedById: params.actorId,
        payrollRunId: run.id,
      },
    });
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PayrollRunStatus.FINALISED,
      finalisedAt: new Date(),
      finalisedById: params.actorId,
      postedAt: new Date(),
    },
  });

  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "PAYROLL_FINALISED",
    entity: "PayrollRun",
    entityId: run.id,
    metadata: { totalGross: Number(run.totalGross), totalEmployer: Number(run.totalEmployer) },
  });

  return updated;
}

export type PayrollRunWithItems = Prisma.PayrollRunGetPayload<{
  include: { items: { include: { employee: true; payslip: true } } };
}>;
