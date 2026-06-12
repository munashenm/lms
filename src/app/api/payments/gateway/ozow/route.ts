import { NextRequest, NextResponse } from "next/server";
import { createOzowPayment, isOzowConfigured } from "@/lib/payment-gateways/ozow";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  if (!isOzowConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "Ozow is not configured. Set OZOW_SITE_CODE and OZOW_PRIVATE_KEY in .env",
      sandboxHint: "Use staging credentials from dash.ozow.com for testing",
    });
  }

  const result = createOzowPayment({
    invoiceId: auth.invoice.id,
    invoiceNumber: auth.invoice.invoiceNumber,
    amount: auth.outstanding,
  });

  return NextResponse.json(result);
}
