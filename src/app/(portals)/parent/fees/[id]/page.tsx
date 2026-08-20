import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getChildStudentIds } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceDetail } from "@/components/finance/invoice-detail";
import { PayOnlineButton } from "@/components/finance/pay-online-button";
import { getOutstandingBalance } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { invoiceDetailInclude, mapInvoiceForDetail } from "@/lib/invoice-view";
import { getDocumentRelease } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import { DocumentsReleasedNotice } from "@/components/documents/documents-released-notice";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; error?: string }>;
}

export default async function ParentInvoiceDetailPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  const childIds = await getChildStudentIds(session!);
  const { id } = await params;
  const query = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceDetailInclude,
  });

  if (!invoice || !childIds.includes(invoice.studentId)) {
    notFound();
  }

  if (invoice.status === "DRAFT") {
    redirect("/parent/fees");
  }

  const mapped = mapInvoiceForDetail(invoice);
  const release = await getDocumentRelease(invoice.studentId);

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/parent/fees">← Back to fees</Link>
      </Button>
      {query.error === "1" ? (
        <p className="text-sm text-danger">The payment could not be completed. You can try again below.</p>
      ) : null}
      {query.cancelled === "1" ? (
        <p className="text-sm text-muted">Payment was cancelled. No amount was taken.</p>
      ) : null}
      {query.paid === "1" && release.released ? (
        <DocumentsReleasedNotice reportsHref="/parent/report-cards" lettersHref="/parent/letters" />
      ) : null}
      {query.paid === "1" && !release.released ? (
        <DocumentsHoldNotice outstandingCents={release.outstandingCents} feesHref="/parent/fees" />
      ) : null}
      <InvoiceDetail invoice={mapped} showPaymentForm={false} />
      <PayOnlineButton
        invoiceId={invoice.id}
        outstanding={getOutstandingBalance(mapped.total, mapped.amountPaid)}
      />
    </div>
  );
}
