import { getSession } from "@/lib/auth";
import { FeeCollectionDesk } from "@/components/finance/fee-collection-desk";
import { loadFeeCollectionPage } from "@/lib/fee-collection-page";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function FinanceCollectFeesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const { studentId } = await searchParams;
  const ctx = await loadFeeCollectionPage(session?.schoolId ?? undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collect fees</h1>
        <p className="text-muted text-sm mt-1">
          Find a learner and record cash, EFT or card collection. Date, time and school details print on the invoice.
        </p>
      </div>
      <FeeCollectionDesk
        schoolName={ctx.schoolName}
        schoolLines={ctx.schoolLines}
        classes={ctx.classes}
        invoiceHref={(id) => `/finance/invoices/${id}`}
        newInvoiceHref="/finance/invoices/new"
        initialStudentId={studentId}
      />
    </div>
  );
}
