"use client";

import { InvoicePdfButton } from "@/components/finance/invoice-pdf-button";
import { PaymentReceiptButton } from "@/components/finance/payment-receipt-button";
import { FeeStatementButton } from "@/components/finance/fee-statement-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CollectionPrintActions({
  invoiceId,
  invoiceNumber,
  paymentId,
  studentId,
  heading = "Print documents",
}: {
  invoiceId: string;
  invoiceNumber: string;
  paymentId?: string | null;
  studentId?: string | null;
  heading?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{heading}</CardTitle>
        <p className="text-sm text-muted">
          Open the PDF and use the browser print dialog for a paper copy.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <InvoicePdfButton invoiceId={invoiceId} invoiceNumber={invoiceNumber} />
        {paymentId ? (
          <PaymentReceiptButton paymentId={paymentId} size="default" label="Print receipt" />
        ) : null}
        {studentId ? (
          <FeeStatementButton studentId={studentId} label="Print statement of account" />
        ) : null}
      </CardContent>
    </Card>
  );
}
