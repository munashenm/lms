import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceDetail } from "@/components/finance/invoice-detail";
import { PayOnlineButton } from "@/components/finance/pay-online-button";
import { getOutstandingBalance } from "@/lib/finance";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentInvoiceDetailPage({ params }: PageProps) {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const { id } = await params;

  if (!student) notFound();

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

  if (!invoice || invoice.studentId !== student.id) {
    notFound();
  }

  if (invoice.status === "DRAFT") {
    redirect("/student/fees");
  }

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
        <Link href="/student/fees">← Back to fees</Link>
      </Button>
      <InvoiceDetail invoice={mapped} showPaymentForm={false} />
      <PayOnlineButton
        invoiceId={invoice.id}
        outstanding={getOutstandingBalance(mapped.total, mapped.amountPaid)}
      />
    </div>
  );
}
