import crypto from "crypto";
import type { ResolvedIntegrations } from "../school-integrations";
import { isYocoReady } from "../school-integrations";
import { UserRole } from "@prisma/client";
import { amountToCents, paymentReturnUrls } from "./return-url";

interface YocoPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  studentEmail?: string;
  studentName: string;
  role?: UserRole;
}

export function isYocoConfigured(config: ResolvedIntegrations) {
  return isYocoReady(config);
}

export async function createYocoCheckout(
  config: ResolvedIntegrations,
  params: YocoPaymentParams
) {
  const secretKey = config.yoco.secretKey;

  if (!secretKey) {
    return { configured: false as const };
  }

  const amountInCents = amountToCents(params.amount);
  const returns = paymentReturnUrls(params.role ?? UserRole.STUDENT, params.invoiceId);
  const successUrl = returns.successUrl;
  const cancelUrl = returns.cancelUrl;
  const failureUrl = returns.failureUrl;

  const res = await fetch("https://payments.yoco.com/api/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: amountInCents,
      currency: "ZAR",
      cancelUrl,
      successUrl,
      failureUrl,
      metadata: {
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
        customerName: params.studentName,
        customerEmail: params.studentEmail ?? undefined,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Yoco checkout failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { redirectUrl?: string; id?: string };
  if (!data.redirectUrl) {
    throw new Error("Yoco checkout did not return a redirect URL");
  }

  return {
    configured: true as const,
    paymentUrl: data.redirectUrl,
    checkoutId: data.id,
    sandbox: secretKey.includes("_test_") || secretKey.startsWith("sk_test"),
  };
}

export function verifyYocoWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  headers: {
    webhookId?: string | null;
    webhookTimestamp?: string | null;
    webhookSignature?: string | null;
  }
) {
  if (!webhookSecret || !headers.webhookId || !headers.webhookTimestamp || !headers.webhookSignature) {
    return false;
  }

  const keyPart = webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret;
  const key = Buffer.from(keyPart, "base64");
  const signedContent = `${headers.webhookId}.${headers.webhookTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

  const signatures = headers.webhookSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig!), Buffer.from(expected));
    } catch {
      return sig === expected;
    }
  });
}
