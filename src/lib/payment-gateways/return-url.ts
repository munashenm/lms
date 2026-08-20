import { UserRole } from "@prisma/client";
import { toCents } from "../money";

export function paymentReturnBasePath(role: UserRole, invoiceId: string) {
  if (role === UserRole.PARENT) return `/parent/fees/${invoiceId}`;
  return `/student/fees/${invoiceId}`;
}

export function paymentReturnUrls(role: UserRole, invoiceId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const path = paymentReturnBasePath(role, invoiceId);
  return {
    successUrl: `${appUrl}${path}?paid=1`,
    cancelUrl: `${appUrl}${path}?cancelled=1`,
    failureUrl: `${appUrl}${path}?error=1`,
    amountInCents: undefined as number | undefined,
    appUrl,
  };
}

export function amountToCents(amount: number): number {
  return toCents(amount);
}
