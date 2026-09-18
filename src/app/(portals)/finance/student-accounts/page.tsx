import { FeeCollectionDesk } from "@/components/finance/fee-collection-desk";
import { loadFeeCollectionPage } from "@/lib/fee-collection-page";
import { getSession } from "@/lib/auth";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function FinanceStudentAccountsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const { studentId } = await searchParams;
  const ctx = await loadFeeCollectionPage(session?.schoolId ?? undefined);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student accounts</h1>
        <p className="text-muted text-sm mt-1">Open a learner ledger, invoices, payments and outstanding balance.</p>
      </div>
      <FeeCollectionDesk
        schoolName={ctx.schoolName}
        schoolLines={ctx.schoolLines}
        classes={ctx.classes}
        invoiceBasePath="/finance/invoices"
        newInvoiceHref="/finance/invoices/new"
        initialStudentId={studentId}
      />
    </div>
  );
}
