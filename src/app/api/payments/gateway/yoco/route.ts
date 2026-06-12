import { NextRequest, NextResponse } from "next/server";
import { createYocoCheckout, isYocoConfigured } from "@/lib/payment-gateways/yoco";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  if (!isYocoConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Yoco is not configured. Set YOCO_SECRET_KEY in .env",
      sandboxHint: "Use sk_test_ keys from Yoco dashboard for testing",
    });
  }

  try {
    const result = await createYocoCheckout({
      invoiceId: auth.invoice.id,
      invoiceNumber: auth.invoice.invoiceNumber,
      amount: auth.outstanding,
      studentEmail: auth.invoice.student.email ?? undefined,
      studentName: `${auth.invoice.student.firstName} ${auth.invoice.student.lastName}`,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[yoco] checkout failed", err);
    return NextResponse.json(
      { message: "Could not create Yoco checkout session" },
      { status: 502 }
    );
  }
}
