import { NextResponse } from "next/server";
import { getAvailablePaymentGateways } from "@/lib/payment-gateways";

export async function GET() {
  return NextResponse.json({ gateways: getAvailablePaymentGateways() });
}
