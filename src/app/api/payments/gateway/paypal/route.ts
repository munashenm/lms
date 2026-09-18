import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { createPayPalOrder } from "@/lib/payment-gateways/paypal";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";
import { getResolvedIntegrations } from "@/lib/school-integrations";
import { prisma } from "@/lib/db";
import { PaymentCaptureStatus, GatewayPaymentStatus } from "@prisma/client";
import { nextReceiptNumber } from "@/lib/finance-catalog";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  const integrations = await getResolvedIntegrations(auth.invoice.schoolId);
  const result = await createPayPalOrder(integrations, {
    invoiceId: auth.invoice.id,
    invoiceNumber: auth.invoice.invoiceNumber,
    amount: auth.outstanding,
    role: auth.session.role,
  });
  if (!result.configured || !("orderId" in result) || !result.orderId) {
    return NextResponse.json({
      configured: Boolean(result.configured),
      message: "message" in result ? result.message : "PayPal is not enabled. Configure it under Admin → Settings → Integrations.",
    });
  }

  await prisma.payment.create({
    data: {
      schoolId: auth.invoice.schoolId,
      invoiceId: auth.invoice.id,
      amount: auth.outstanding,
      method: PaymentMethod.PAYPAL,
      reference: `paypal:${result.orderId}`,
      bankReference: result.orderId,
      notes: "PayPal checkout initiated",
      receiptNumber: await nextReceiptNumber(auth.invoice.schoolId),
      recordedById: auth.session.userId,
      gatewayProvider: "paypal",
      gatewayTxnId: result.orderId,
      gatewayStatus: GatewayPaymentStatus.INITIATED,
      captureStatus: PaymentCaptureStatus.PENDING,
    },
  });

  return NextResponse.json(result);
}
