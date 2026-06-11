import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getOutstandingBalance } from "@/lib/finance";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      ...getSchoolFilter(session!),
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
    orderBy: { dueDate: "asc" },
  });

  const debtorMap = new Map<
    string,
    {
      student: (typeof invoices)[0]["student"];
      outstanding: number;
      invoiceCount: number;
      oldestDue: Date | null;
    }
  >();

  for (const inv of invoices) {
    const outstanding = getOutstandingBalance(Number(inv.total), Number(inv.amountPaid));
    if (outstanding <= 0) continue;

    const existing = debtorMap.get(inv.studentId);
    if (existing) {
      existing.outstanding += outstanding;
      existing.invoiceCount += 1;
      if (inv.dueDate && (!existing.oldestDue || inv.dueDate < existing.oldestDue)) {
        existing.oldestDue = inv.dueDate;
      }
    } else {
      debtorMap.set(inv.studentId, {
        student: inv.student,
        outstanding,
        invoiceCount: 1,
        oldestDue: inv.dueDate,
      });
    }
  }

  const debtors = Array.from(debtorMap.values()).sort((a, b) => b.outstanding - a.outstanding);

  return NextResponse.json({
    debtors,
    totalOutstanding: debtors.reduce((s, d) => s + d.outstanding, 0),
  });
}
