import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { PaymentPlanManager } from "@/components/finance/payment-plan-manager";

export default async function FinanceChargesPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [students, charges, years, feeStructures] = await Promise.all([
    prisma.student.findMany({
      where: { ...filter, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, studentNumber: true },
      orderBy: { lastName: "asc" },
      take: 400,
    }),
    prisma.studentCharge.findMany({
      where: { ...filter, reversedAt: null },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
        instalments: { orderBy: { sequence: "asc" } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.academicYear.findMany({ where: filter, orderBy: { startDate: "desc" }, take: 8 }),
    prisma.feeStructure.findMany({
      where: { ...filter, isActive: true },
      select: { id: true, name: true, amount: true, chargeSource: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Charges & payment plans</h1>
        <p className="text-muted text-sm mt-1">
          Manual, hostel and transport charges append ledger rows. Instalments are created only when you set a count greater than 1.
        </p>
      </div>
      <PaymentPlanManager
        students={students}
        charges={charges}
        years={years}
        feeStructures={feeStructures.map((fee) => ({ ...fee, amount: Number(fee.amount) }))}
      />
    </div>
  );
}
