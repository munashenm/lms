import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResolvedIntegrations } from "@/lib/school-integrations";
import {
  invoiceIdFromPaystackReference,
  verifyPaystackSignature,
} from "@/lib/payment-gateways/paystack";
import { settlePaystackReference } from "@/lib/payment-gateways/settle-paystack";

interface PaystackWebhookEvent {
  event?: string;
  data?: {
    reference?: string;
    metadata?: { invoiceId?: string };
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const reference = event.data?.reference;
  const invoiceId = event.data?.metadata?.invoiceId ?? invoiceIdFromPaystackReference(reference);
  if (!invoiceId || !reference) {
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
  const secretKey = integrations.paystack.secretKey;
  if (!secretKey || !verifyPaystackSignature(secretKey, rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  await settlePaystackReference(reference);
  return NextResponse.json({ received: true });
}
