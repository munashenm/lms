import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentReceiptButton } from "@/components/finance/payment-receipt-button";
import { PaymentReverseButton } from "@/components/finance/payment-reverse-button";
import { PaymentReviewActions } from "@/components/finance/payment-review-actions";
import { PAYMENT_METHOD_LABELS, PAYMENT_CAPTURE_STATUS_LABELS } from "@/lib/finance";
import { formatDateTime, formatZAR } from "@/lib/utils";

export default async function AdminFinancePaymentsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const canApprove = requirePermission(session, "finance.payments.approve");

  const payments = await prisma.payment.findMany({
    where: { invoice: filter },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    take: 150,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted text-sm mt-1">Manual EFT captures stay pending until verified and approved.</p>
        </div>
        <Button asChild>
          <Link href="/admin/finance/collect">Collect fees</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Invoice</th>
                    <th className="text-right px-4 py-3 font-medium text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted">{formatDateTime(p.paidAt)}</td>
                      <td className="px-4 py-3 font-medium">{formatZAR(Number(p.amount))}</td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{PAYMENT_CAPTURE_STATUS_LABELS[p.captureStatus] ?? p.captureStatus}</Badge>
                      </td>
                      <td className="px-4 py-3">{p.invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {p.proofUrl ? (
                            <a href={p.proofUrl} className="text-xs text-primary" target="_blank" rel="noreferrer">
                              Proof
                            </a>
                          ) : null}
                          <PaymentReceiptButton paymentId={p.id} />
                          {!p.reversedAt && !p.reversalOfId && p.captureStatus === "APPROVED" ? (
                            <PaymentReverseButton paymentId={p.id} />
                          ) : null}
                          <PaymentReviewActions paymentId={p.id} status={p.captureStatus} canApprove={canApprove} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
