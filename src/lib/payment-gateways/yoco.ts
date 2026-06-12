import crypto from "crypto";

interface YocoPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  studentEmail?: string;
  studentName: string;
}

export function isYocoConfigured() {
  return Boolean(process.env.YOCO_SECRET_KEY);
}

export async function createYocoCheckout(params: YocoPaymentParams) {
  const secretKey = process.env.YOCO_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!secretKey) {
    return { configured: false as const };
  }

  const amountInCents = Math.round(params.amount * 100);
  const successUrl = `${appUrl}/student/fees/${params.invoiceId}?paid=1`;
  const cancelUrl = `${appUrl}/student/fees/${params.invoiceId}?cancelled=1`;
  const failureUrl = `${appUrl}/student/fees/${params.invoiceId}?error=1`;

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
  rawBody: string,
  headers: {
    webhookId?: string | null;
    webhookTimestamp?: string | null;
    webhookSignature?: string | null;
  }
) {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret || !headers.webhookId || !headers.webhookTimestamp || !headers.webhookSignature) {
    return false;
  }

  const keyPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
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
