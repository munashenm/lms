import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyYocoWebhookSignature } from "@/lib/payment-gateways/yoco";
import { recordGatewayPayment } from "@/lib/payment-gateways/record-payment";
import { getResolvedIntegrations } from "@/lib/school-integrations";

interface YocoWebhookEvent {
  type?: string;
  payload?: {
    metadata?: { invoiceId?: string };
    amount?: number;
    id?: string;
    status?: string;
  };
}

/** Yoco Standard Webhooks — records payment on payment.succeeded */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let event: YocoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as YocoWebhookEvent;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const invoiceId = event.payload?.metadata?.invoiceId;
  if (!invoiceId) {
    return NextResponse.json({ received: true });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { schoolId: true },
  });

  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  const integrations = await getResolvedIntegrations(invoice.schoolId);
  const webhookSecret = integrations.yoco.webhookSecret;

  const valid = webhookSecret
    ? verifyYocoWebhookSignature(webhookSecret, rawBody, {
        webhookId: request.headers.get("webhook-id"),
        webhookTimestamp: request.headers.get("webhook-timestamp"),
        webhookSignature: request.headers.get("webhook-signature"),
      })
    : false;

  if (!valid) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "payment.succeeded") {
    return NextResponse.json({ received: true });
  }

  const amountCents = event.payload?.amount ?? 0;
  const amount = amountCents / 100;
  const reference = event.payload?.id ?? `YOCO-${Date.now()}`;

  if (amount <= 0) {
    return NextResponse.json({ received: true });
  }

  await recordGatewayPayment({
    invoiceId,
    amount,
    method: "YOCO",
    reference,
    notes: "Yoco webhook",
  });

  return NextResponse.json({ received: true });
}
