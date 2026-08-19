import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { getOutstandingBalance } from "@/lib/finance";
import { roundMoney } from "@/lib/money";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.reports.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const filter = getSchoolFilter(session!);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
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
      where: { ...("schoolId" in filter ? { schoolId: filter.schoolId } : {}), reversedAt: null },
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
  const studentIncome = collected;
  const totalIncome = roundMoney(income + studentIncome);
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

  return NextResponse.json({
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
  });
}
