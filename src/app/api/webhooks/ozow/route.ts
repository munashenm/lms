import { NextRequest, NextResponse } from "next/server";
import { verifyOzowNotifyHash } from "@/lib/payment-gateways/ozow";
import { recordGatewayPayment } from "@/lib/payment-gateways/record-payment";

/** Ozow NotifyUrl webhook — records payment when status is Complete */
export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const fields = {
    SiteCode: formData.get("SiteCode")?.toString() ?? "",
    TransactionId: formData.get("TransactionId")?.toString() ?? "",
    TransactionReference: formData.get("TransactionReference")?.toString() ?? "",
    Amount: formData.get("Amount")?.toString() ?? "",
    Status: formData.get("Status")?.toString() ?? "",
    Optional1: formData.get("Optional1")?.toString(),
    Optional2: formData.get("Optional2")?.toString(),
    Optional3: formData.get("Optional3")?.toString(),
    Optional4: formData.get("Optional4")?.toString(),
    Optional5: formData.get("Optional5")?.toString(),
    CurrencyCode: formData.get("CurrencyCode")?.toString(),
    IsTest: formData.get("IsTest")?.toString(),
    StatusMessage: formData.get("StatusMessage")?.toString(),
  };

  const hash = formData.get("Hash")?.toString() ?? "";

  if (!fields.TransactionReference || !verifyOzowNotifyHash(fields, hash)) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (fields.Status !== "Complete") {
    return NextResponse.json({ received: true });
  }

  const amount = parseFloat(fields.Amount);
  if (amount <= 0) {
    return NextResponse.json({ received: true });
  }

  await recordGatewayPayment({
    invoiceId: fields.TransactionReference,
    amount,
    method: "OZOW",
    reference: fields.TransactionId || `OZ-${Date.now()}`,
    notes: "Ozow NotifyUrl",
  });

  return NextResponse.json({ received: true });
}
