import { NextRequest, NextResponse } from "next/server";
import { verifyYocoWebhookSignature } from "@/lib/payment-gateways/yoco";
import { recordGatewayPayment } from "@/lib/payment-gateways/record-payment";

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
  const valid = verifyYocoWebhookSignature(rawBody, {
    webhookId: request.headers.get("webhook-id"),
    webhookTimestamp: request.headers.get("webhook-timestamp"),
    webhookSignature: request.headers.get("webhook-signature"),
  });

  if (!valid) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let event: YocoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as YocoWebhookEvent;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "payment.succeeded") {
    return NextResponse.json({ received: true });
  }

  const invoiceId = event.payload?.metadata?.invoiceId;
  const amountCents = event.payload?.amount ?? 0;
  const amount = amountCents / 100;
  const reference = event.payload?.id ?? `YOCO-${Date.now()}`;

  if (!invoiceId || amount <= 0) {
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
