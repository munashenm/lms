import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { InvoiceForm } from "@/components/finance/invoice-form";
import { getActiveFeeSchedule } from "@/lib/fee-schedule";

export default async function NewInvoicePage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [students, feeScheduleItems] = await Promise.all([
    prisma.student.findMany({
      where: { ...filter, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, studentNumber: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    "schoolId" in filter ? getActiveFeeSchedule(filter.schoolId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-muted text-sm mt-1">Create a fee invoice for a student</p>
      </div>
      <InvoiceForm
        students={students}
        feeScheduleItems={feeScheduleItems.map((item) => ({
          name: item.name,
          amount: Number(item.amount),
        }))}
      />
    </div>
  );
}
