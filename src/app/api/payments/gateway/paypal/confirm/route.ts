import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settlePayPalOrder } from "@/lib/payment-gateways/settle-paypal";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("token") ?? request.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ message: "Missing PayPal order" }, { status: 400 });
  const payment = await prisma.payment.findFirst({
    where: { gatewayTxnId: orderId },
    select: { schoolId: true },
  });
  if (!payment) return NextResponse.json({ verified: false, message: "Unknown order" }, { status: 404 });
  const result = await settlePayPalOrder(payment.schoolId, orderId);
  return NextResponse.json({ verified: result.ok, result });
}
