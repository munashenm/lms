import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { InvoiceDetail } from "@/components/finance/invoice-detail";
import { Button } from "@/components/ui/button";
import { invoiceDetailInclude, mapInvoiceForDetail } from "@/lib/invoice-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInvoiceDetailPage({ params }: PageProps) {
  await getSession();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceDetailInclude,
  });

  if (!invoice) notFound();

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/finance/invoices">← Back to invoices</Link>
      </Button>
      <InvoiceDetail invoice={mapInvoiceForDetail(invoice)} showPaymentForm />
    </div>
  );
}
