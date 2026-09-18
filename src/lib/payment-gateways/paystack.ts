import crypto from "crypto";
import type { ResolvedIntegrations } from "../school-integrations";
import { isPaystackReady } from "../school-integrations";
import { UserRole } from "@prisma/client";
import { amountToCents, paymentReturnUrls } from "./return-url";

interface PaystackPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  studentEmail?: string;
  studentName: string;
  role?: UserRole;
}

interface PaystackVerifyData {
  status?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  metadata?: { invoiceId?: string };
}

export function isPaystackConfigured(config: ResolvedIntegrations) {
  return isPaystackReady(config);
}

export function paystackReference(invoiceId: string) {
  return `paystack_${invoiceId}_${Date.now().toString(36)}`;
}

export function invoiceIdFromPaystackReference(reference: string | null | undefined) {
  if (!reference) return null;
  const match = reference.match(/^paystack_([^_]+)_/);
  return match?.[1] ?? null;
}

export function verifyPaystackSignature(secretKey: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const digest = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expected = Buffer.from(digest);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export async function createPaystackPayment(config: ResolvedIntegrations, params: PaystackPaymentParams) {
  const secretKey = config.paystack.secretKey;
  if (!secretKey) return { configured: false as const };

  const returns = paymentReturnUrls(params.role ?? UserRole.STUDENT, params.invoiceId);
  const reference = paystackReference(params.invoiceId);
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.studentEmail || "fees@schoolhub.local",
      amount: amountToCents(params.amount),
      currency: "ZAR",
      reference,
      callback_url: `${returns.appUrl}/api/payments/gateway/paystack/confirm`,
      metadata: {
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
        studentName: params.studentName,
      },
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };
  if (!res.ok || !payload.status || !payload.data?.authorization_url) {
    return {
      configured: true as const,
      paymentUrl: null as string | null,
      message: payload.message ?? "Could not create Paystack checkout",
    };
  }
  return {
    configured: true as const,
    paymentUrl: payload.data.authorization_url,
    reference: payload.data.reference ?? reference,
  };
}

export async function verifyPaystackTransaction(secretKey: string, reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const payload = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    data?: PaystackVerifyData;
  };
  if (!res.ok || !payload.status || !payload.data) return null;
  return payload.data;
}
