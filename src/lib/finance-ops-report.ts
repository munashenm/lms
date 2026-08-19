import { prisma } from "./db";
import { COLLECTED_PAYMENT_WHERE, getOutstandingBalance } from "./finance";
import { roundMoney } from "./money";
import { toCsv } from "./csv";

type SchoolFilter = { schoolId?: string };

export async function getFinanceOpsReport(
  filter: SchoolFilter,
  opts?: { from?: string | null; to?: string | null }
) {
  const from = opts?.from;
  const to = opts?.to;
  const dateWhere = {
    ...(from || to
      ? {
          entryDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [invoices, payments, ledger, charges] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...filter, status: { not: "CANCELLED" } },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true, gradeId: true, classId: true } },
      },
    }),
    prisma.payment.findMany({
      where: { ...("schoolId" in filter ? { schoolId: filter.schoolId } : {}), ...COLLECTED_PAYMENT_WHERE },
    }),
    prisma.ledgerEntry.findMany({ where: { ...filter, ...dateWhere } }),
    prisma.studentCharge.findMany({
      where: { ...filter, reversedAt: null },
      include: { feeStructure: { select: { courseId: true, gradeId: true, moduleId: true, chargeSource: true } } },
    }),
  ]);

  const feesRaised = invoices.reduce((s, i) => s + Number(i.total), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const overdue = invoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)), 0);
  const income = ledger.filter((e) => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
  const expenses = ledger.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = roundMoney(income + collected);
  const collectionRate = feesRaised > 0 ? collected / feesRaised : 0;

  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }

  const revenueByGrade: Record<string, number> = {};
  const revenueByCourse: Record<string, number> = {};
  const revenueByModule: Record<string, number> = {};
  for (const c of charges) {
    const amt = Number(c.amount);
    if (c.feeStructure?.gradeId) {
      revenueByGrade[c.feeStructure.gradeId] = (revenueByGrade[c.feeStructure.gradeId] ?? 0) + amt;
    }
    if (c.feeStructure?.courseId) {
      revenueByCourse[c.feeStructure.courseId] = (revenueByCourse[c.feeStructure.courseId] ?? 0) + amt;
    }
    if (c.feeStructure?.moduleId) {
      revenueByModule[c.feeStructure.moduleId] = (revenueByModule[c.feeStructure.moduleId] ?? 0) + amt;
    }
  }

  const expensesByCategory: Record<string, number> = {};
  for (const e of ledger.filter((row) => row.type === "EXPENSE")) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + Number(e.amount);
  }

  const monthly: Record<string, { income: number; expenses: number; collections: number }> = {};
  for (const e of ledger) {
    const key = e.entryDate.toISOString().slice(0, 7);
    monthly[key] ??= { income: 0, expenses: 0, collections: 0 };
    if (e.type === "INCOME") monthly[key].income += Number(e.amount);
    else monthly[key].expenses += Number(e.amount);
  }
  for (const p of payments) {
    const key = p.paidAt.toISOString().slice(0, 7);
    monthly[key] ??= { income: 0, expenses: 0, collections: 0 };
    monthly[key].collections += Number(p.amount);
  }

  const debtors = invoices
    .filter((i) => getOutstandingBalance(Number(i.total), Number(i.amountPaid)) > 0.009)
    .map((i) => ({
      invoiceId: i.id,
      invoiceNumber: i.invoiceNumber,
      student: `${i.student.firstName} ${i.student.lastName}`,
      studentNumber: i.student.studentNumber,
      outstanding: getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
      status: i.status,
      dueDate: i.dueDate,
    }));

  return {
    cards: {
      feesRaised,
      collected,
      outstanding,
      overdue,
      totalIncome,
      totalExpenses: expenses,
      netPosition: roundMoney(totalIncome - expenses),
      collectionRate,
    },
    byMethod,
    revenueByGrade,
    revenueByCourse,
    revenueByModule,
    expensesByCategory,
    monthly,
    debtors,
  };
}

export type FinanceOpsReport = Awaited<ReturnType<typeof getFinanceOpsReport>>;

export function financeOpsSectionCsv(section: string, report: FinanceOpsReport): string | null {
  if (section === "debtors") {
    return toCsv(
      ["Student number", "Student", "Invoice", "Outstanding", "Status", "Due date"],
      report.debtors.map((row) => [
        row.studentNumber,
        row.student,
        row.invoiceNumber,
        row.outstanding.toFixed(2),
        row.status,
        row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
      ])
    );
  }
  if (section === "methods") {
    return toCsv(
      ["Method", "Collected (ZAR)"],
      Object.entries(report.byMethod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([method, amount]) => [method, amount.toFixed(2)])
    );
  }
  if (section === "expenses") {
    return toCsv(
      ["Category", "Amount (ZAR)"],
      Object.entries(report.expensesByCategory)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, amount]) => [category, amount.toFixed(2)])
    );
  }
  if (section === "monthly") {
    return toCsv(
      ["Month", "Income (ZAR)", "Expenses (ZAR)", "Collections (ZAR)"],
      Object.entries(report.monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, row]) => [
          month,
          row.income.toFixed(2),
          row.expenses.toFixed(2),
          row.collections.toFixed(2),
        ])
    );
  }
  return null;
}
