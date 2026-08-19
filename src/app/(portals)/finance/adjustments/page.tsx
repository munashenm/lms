import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { FinanceAdjustments } from "@/components/finance/finance-adjustments";

export default async function FinanceAdjustmentsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [students, creditNotes, refunds, awards] = await Promise.all([
    prisma.student.findMany({
      where: { ...filter, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, studentNumber: true },
      orderBy: { lastName: "asc" },
      take: 400,
    }),
    prisma.creditNote.findMany({
      where: filter,
      include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.refund.findMany({
      where: filter,
      include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.studentAidAward.findMany({
      where: filter,
      include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credits, refunds and aid</h1>
        <p className="text-muted text-sm mt-1">
          Each action appends a student ledger row. Receipts and payments are never deleted.
        </p>
      </div>
      <FinanceAdjustments students={students} creditNotes={creditNotes} refunds={refunds} awards={awards} />
    </div>
  );
}
