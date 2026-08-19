import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentForm } from "./payment-form";
import { PaymentReceiptButton } from "./payment-receipt-button";
import { PaymentReverseButton } from "./payment-reverse-button";
import { InvoicePdfButton } from "./invoice-pdf-button";
import { InstalmentSchedule, type InstalmentView } from "./instalment-schedule";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
  PAYMENT_METHOD_LABELS,
  getOutstandingBalance,
} from "@/lib/finance";
import { formatDate, formatZAR } from "@/lib/utils";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  amount: number | string;
}

interface Payment {
  id: string;
  amount: number | string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date | string;
  reversedAt?: Date | string | null;
  reversalOfId?: string | null;
}

interface InvoiceDetailProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    description: string | null;
    status: InvoiceStatus;
    subtotal: number | string;
    discount: number | string;
    total: number | string;
    amountPaid: number | string;
    dueDate: Date | string | null;
    issuedAt: Date | string;
    student: {
      firstName: string;
      lastName: string;
      studentNumber: string;
      grade?: { name: string } | null;
      class?: { name: string } | null;
    };
    lineItems: LineItem[];
    payments: Payment[];
    instalments?: InstalmentView[];
  };
  showPaymentForm?: boolean;
}

export function InvoiceDetail({ invoice, showPaymentForm = true }: InvoiceDetailProps) {
  const outstanding = getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
          <p className="text-muted text-sm mt-1">
            {invoice.student.firstName} {invoice.student.lastName} · {invoice.student.studentNumber}
            {invoice.student.grade && ` · ${invoice.student.grade.name}`}
          </p>
          {invoice.description && (
            <p className="text-sm mt-2">{invoice.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <InvoicePdfButton
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
          />
          <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted">Issued</p>
          <p className="font-medium">{formatDate(invoice.issuedAt)}</p>
        </div>
        <div>
          <p className="text-muted">Due</p>
          <p className="font-medium">{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</p>
        </div>
        <div>
          <p className="text-muted">Total</p>
          <p className="font-medium">{formatZAR(invoice.total)}</p>
        </div>
        <div>
          <p className="text-muted">Outstanding</p>
          <p className="font-medium text-danger">{outstanding > 0 ? formatZAR(outstanding) : "Paid"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Unit Price</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatZAR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={3} className="px-4 py-2 text-right text-muted">Subtotal</td>
                <td className="px-4 py-2 text-right">{formatZAR(invoice.subtotal)}</td>
              </tr>
              {Number(invoice.discount) > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted">Discount / Scholarship</td>
                  <td className="px-4 py-2 text-right text-success">−{formatZAR(invoice.discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold">{formatZAR(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {invoice.instalments && invoice.instalments.length > 0 ? (
        <InstalmentSchedule instalments={invoice.instalments} />
      ) : null}

      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {invoice.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className={`font-medium ${p.reversedAt || p.reversalOfId ? "line-through text-muted" : ""}`}>
                      {formatZAR(p.amount)}
                    </p>
                    <p className="text-xs text-muted">
                      {PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference && ` · Ref: ${p.reference}`}
                      {" · "}
                      {formatDate(p.paidAt)}
                      {p.reversedAt ? " · Reversed" : ""}
                      {p.reversalOfId ? " · Reversal" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentReceiptButton paymentId={p.id} />
                    {showPaymentForm && !p.reversedAt && !p.reversalOfId ? (
                      <PaymentReverseButton paymentId={p.id} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showPaymentForm && (
        <PaymentForm
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          outstanding={outstanding}
          instalments={invoice.instalments?.map((row) => ({
            id: row.id,
            sequence: row.sequence,
            dueDate: row.dueDate,
            amount: Number(row.amount),
            amountPaid: Number(row.amountPaid),
            status: row.status,
          }))}
        />
      )}
    </div>
  );
}
