import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceList } from "@/components/finance/invoice-list";
import { ChildFilter } from "@/components/finance/child-filter";
import { StatCard } from "@/components/dashboard/stat-card";
import { getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { CreditCard, TrendingDown } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentFeesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const invoices = filterIds.length
    ? await prisma.invoice.findMany({
        where: { studentId: { in: filterIds }, status: { not: "DRAFT" } },
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
        <h1 className="text-2xl font-bold">Fees & Invoices</h1>
        <p className="text-muted text-sm mt-1">View fee statements for your children</p>
      </div>

      <ChildFilter
        children={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/fees"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Outstanding" value={formatZAR(totalOutstanding)} icon={TrendingDown} />
        <StatCard title="Paid to Date" value={formatZAR(totalPaid)} icon={CreditCard} />
      </div>

      <InvoiceList
        invoices={mapped}
        detailHref={(id) => `/parent/fees/${id}`}
      />
    </div>
  );
}
