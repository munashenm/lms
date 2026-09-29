import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { getOutstandingBalance } from "@/lib/finance";
import { buildDebtorsAgeAnalysis } from "@/lib/finance/debtors-age";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const asOfParam = request.nextUrl.searchParams.get("asOf");
  const asOf = asOfParam ? new Date(asOfParam) : new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      schoolId,
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          grade: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
    },
  });

  const agedInput = invoices.map((inv) => ({
    invoiceId: inv.id,
    studentId: inv.studentId,
    outstanding: getOutstandingBalance(Number(inv.total), Number(inv.amountPaid)),
    dueDate: inv.dueDate,
  }));

  const analysis = buildDebtorsAgeAnalysis(agedInput, asOf);
  const studentMap = new Map(invoices.map((i) => [i.studentId, i.student]));

  return NextResponse.json({
    asOf: asOf.toISOString(),
    totals: analysis.totals,
    totalOutstanding: analysis.totalOutstanding,
    rows: analysis.rows.map((row) => ({
      ...row,
      student: studentMap.get(row.studentId) ?? null,
    })),
  });
}