import { NextRequest, NextResponse } from "next/server";
import { recordGatewayPayment } from "@/lib/payment-gateways/record-payment";

/** PayFast ITN webhook — records payment when gateway confirms */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const paymentStatus = formData.get("payment_status")?.toString();
  const invoiceId = formData.get("m_payment_id")?.toString();
  const amount = parseFloat(formData.get("amount_gross")?.toString() ?? "0");
  const pfPaymentId = formData.get("pf_payment_id")?.toString();

  if (!invoiceId || paymentStatus !== "COMPLETE" || amount <= 0) {
    return NextResponse.json({ received: true });
  }

  await recordGatewayPayment({
    invoiceId,
    amount,
    method: "PAYFAST",
    reference: pfPaymentId ?? `PF-${Date.now()}`,
    notes: "PayFast ITN",
  });

  return NextResponse.json({ received: true });
}
