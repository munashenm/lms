import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settlePayPalOrder } from "@/lib/payment-gateways/settle-paypal";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as {
    resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
    resource_type?: string;
  };
  const orderId =
    payload.resource?.id && payload.resource_type === "checkout-order"
      ? payload.resource.id
      : payload.resource?.supplementary_data?.related_ids?.order_id ?? payload.resource?.id;
  if (!orderId) return NextResponse.json({ ok: true });

  const payment = await prisma.payment.findFirst({
    where: { gatewayTxnId: orderId },
    select: { schoolId: true },
  });
  if (!payment) return NextResponse.json({ ok: true });
  await settlePayPalOrder(payment.schoolId, orderId);
  return NextResponse.json({ ok: true });
}
