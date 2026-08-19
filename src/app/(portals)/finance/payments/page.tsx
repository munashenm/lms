import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentReceiptButton } from "@/components/finance/payment-receipt-button";
import { PaymentReverseButton } from "@/components/finance/payment-reverse-button";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance";
import { formatDate, formatZAR } from "@/lib/utils";

export default async function FinancePaymentsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

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
    take: 100,
  });

  const collected = payments
    .filter((p) => !p.reversedAt && !p.reversalOfId)
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted text-sm mt-1">
          {payments.length} recent receipts · {formatZAR(collected)} collected (reversals excluded)
        </p>
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
                    <th className="text-left px-4 py-3 font-medium text-muted">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Reference</th>
                    <th className="text-right px-4 py-3 font-medium text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted">{formatDate(p.paidAt)}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatZAR(Number(p.amount))}
                        {p.reversedAt ? <Badge variant="secondary" className="ml-2">Reversed</Badge> : null}
                        {p.reversalOfId ? <Badge variant="warning" className="ml-2">Reversal</Badge> : null}
                      </td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td className="px-4 py-3">{p.invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {p.invoice.student.firstName} {p.invoice.student.lastName}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted">
                        {p.reference ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <PaymentReceiptButton paymentId={p.id} />
                          {!p.reversedAt && !p.reversalOfId ? (
                            <PaymentReverseButton paymentId={p.id} />
                          ) : null}
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
