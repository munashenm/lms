import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
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

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted text-sm mt-1">
          {payments.length} recent payments · {formatZAR(total)} recorded
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
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted">{formatDate(p.paidAt)}</td>
                      <td className="px-4 py-3 font-medium">{formatZAR(Number(p.amount))}</td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td className="px-4 py-3">{p.invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {p.invoice.student.firstName} {p.invoice.student.lastName}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted">
                        {p.reference ?? "—"}
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
