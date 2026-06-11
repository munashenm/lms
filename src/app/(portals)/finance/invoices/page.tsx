import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { InvoiceList } from "@/components/finance/invoice-list";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function FinanceInvoicesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const { studentId } = await searchParams;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...filter,
      ...(studentId && { studentId }),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  const mapped = invoices.map((i) => ({
    ...i,
    total: Number(i.total),
    amountPaid: Number(i.amountPaid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted text-sm mt-1">{invoices.length} invoices</p>
        </div>
        <Button asChild>
          <Link href="/finance/invoices/new">New Invoice</Link>
        </Button>
      </div>
      <InvoiceList invoices={mapped} detailHref={(id) => `/finance/invoices/${id}`} />
    </div>
  );
}
