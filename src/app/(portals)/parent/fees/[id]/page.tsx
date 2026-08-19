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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParentInvoiceDetailPage({ params }: PageProps) {
  const session = await getSession();
  const childIds = await getChildStudentIds(session!);
  const { id } = await params;

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

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/parent/fees">← Back to fees</Link>
      </Button>
      <InvoiceDetail invoice={mapped} showPaymentForm={false} />
      <PayOnlineButton
        invoiceId={invoice.id}
        outstanding={getOutstandingBalance(mapped.total, mapped.amountPaid)}
      />
    </div>
  );
}
