import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordGatewayPayment } from "@/lib/payment-gateways/record-payment";
import { getResolvedIntegrations } from "@/lib/school-integrations";
import {
  formDataToPayFastFields,
  payFastAmountAcceptable,
  verifyPayFastItnSignature,
} from "@/lib/payfast-itn";
import { getOutstandingBalance } from "@/lib/finance";

/** PayFast ITN webhook — records payment only after signature and amount checks. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const fields = formDataToPayFastFields(formData);
  const paymentStatus = fields.payment_status;
  const invoiceId = fields.m_payment_id;
  const amount = parseFloat(fields.amount_gross ?? "0");
  const pfPaymentId = fields.pf_payment_id;
  const signature = fields.signature ?? "";

  if (!invoiceId || paymentStatus !== "COMPLETE" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ received: true });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { schoolId: true, total: true, amountPaid: true },
  });
  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  const integrations = await getResolvedIntegrations(invoice.schoolId);
  const passphrase = integrations.payfast.passphrase;
  if (!passphrase || !verifyPayFastItnSignature(fields, passphrase, signature)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  if (integrations.payfast.merchantId && fields.merchant_id && fields.merchant_id !== integrations.payfast.merchantId) {
    return NextResponse.json({ message: "Merchant mismatch" }, { status: 401 });
  }

  const outstanding = getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid));
  if (!payFastAmountAcceptable(amount, outstanding)) {
    return NextResponse.json({ message: "Amount mismatch" }, { status: 400 });
  }

  await recordGatewayPayment({
    invoiceId,
    amount,
    method: "PAYFAST",
    reference: pfPaymentId || `PF-${invoiceId}`,
    notes: "PayFast ITN",
  });

  return NextResponse.json({ received: true });
}
