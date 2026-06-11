import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { InvoiceForm } from "@/components/finance/invoice-form";

export default async function FinanceNewInvoicePage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const students = await prisma.student.findMany({
    where: { ...filter, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, studentNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-muted text-sm mt-1">Create a fee invoice for a student</p>
      </div>
      <InvoiceForm
        students={students}
        redirectTo="/finance/invoices"
      />
    </div>
  );
}
