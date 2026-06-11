import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { InvoiceDetail } from "@/components/finance/invoice-detail";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInvoiceDetailPage({ params }: PageProps) {
  await getSession();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          grade: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
      lineItems: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const mapped = {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    lineItems: invoice.lineItems.map((li) => ({
      ...li,
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
    })),
    payments: invoice.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/finance/invoices">← Back to invoices</Link>
      </Button>
      <InvoiceDetail invoice={mapped} showPaymentForm />
    </div>
  );
}
