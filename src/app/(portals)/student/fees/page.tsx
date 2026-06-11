import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceList } from "@/components/finance/invoice-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { CreditCard, TrendingDown } from "lucide-react";

export default async function StudentFeesPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const invoices = student
    ? await prisma.invoice.findMany({
        where: { studentId: student.id, status: { not: "DRAFT" } },
        include: {
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
        orderBy: { issuedAt: "desc" },
      })
    : [];

  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);

  const mapped = invoices.map((i) => ({
    ...i,
    total: Number(i.total),
    amountPaid: Number(i.amountPaid),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Fees</h1>
        <p className="text-muted text-sm mt-1">Your fee statements and payment history</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Outstanding" value={formatZAR(totalOutstanding)} icon={TrendingDown} />
        <StatCard title="Paid to Date" value={formatZAR(totalPaid)} icon={CreditCard} />
      </div>

      <InvoiceList
        invoices={mapped}
        detailHref={(id) => `/student/fees/${id}`}
      />
    </div>
  );
}
