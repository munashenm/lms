import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { invoiceIdFromPaystackReference } from "@/lib/payment-gateways/paystack";
import { settlePaystackReference } from "@/lib/payment-gateways/settle-paystack";
import { paymentReturnUrls } from "@/lib/payment-gateways/return-url";

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref");
  const invoiceId = invoiceIdFromPaystackReference(reference);
  const session = await getSession();
  const role = session?.role ?? UserRole.STUDENT;
  const fallback = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (!reference || !invoiceId) {
    return NextResponse.redirect(`${fallback}/student/fees?error=1`);
  }

  const urls = paymentReturnUrls(role, invoiceId);
  const result = await settlePaystackReference(reference);
  if (result.ok) {
    return NextResponse.redirect(urls.successUrl);
  }
  return NextResponse.redirect(urls.failureUrl);
}
