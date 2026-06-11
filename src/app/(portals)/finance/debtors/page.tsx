import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { DebtorTable } from "@/components/finance/debtor-table";
import { getOutstandingBalance } from "@/lib/finance";

export default async function FinanceDebtorsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const invoices = await prisma.invoice.findMany({
    where: {
      ...filter,
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
  const totalOutstanding = debtors.reduce((s, d) => s + d.outstanding, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Debtors</h1>
        <p className="text-muted text-sm mt-1">Students with outstanding fee balances</p>
      </div>
      <DebtorTable
        debtors={debtors}
        totalOutstanding={totalOutstanding}
        studentHref={(id) => `/finance/invoices?studentId=${id}`}
      />
    </div>
  );
}
