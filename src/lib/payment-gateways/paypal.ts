import type { ResolvedIntegrations } from "../school-integrations";
import { isPayPalReady } from "../school-integrations";
import { UserRole } from "@prisma/client";
import { paymentReturnUrls } from "./return-url";

function paypalBase(sandbox: boolean) {
  return sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

export function isPayPalConfigured(config: ResolvedIntegrations) {
  return isPayPalReady(config);
}

export async function paypalAccessToken(config: ResolvedIntegrations): Promise<string | null> {
  const clientId = config.paypal.clientId;
  const secret = config.paypal.secret;
  if (!clientId || !secret) return null;
  const res = await fetch(`${paypalBase(config.paypal.sandbox)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function createPayPalOrder(
  config: ResolvedIntegrations,
  params: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    role?: UserRole;
  }
) {
  if (!isPayPalConfigured(config) || !config.paypal.clientId || !config.paypal.secret) {
    return { configured: false as const };
  }
  const token = await paypalAccessToken(config);
  if (!token) return { configured: false as const, message: "PayPal authentication failed" };
  const returns = paymentReturnUrls(params.role ?? UserRole.STUDENT, params.invoiceId);
  const currency = (config.paypal.currency || "ZAR").toUpperCase();
  const res = await fetch(`${paypalBase(config.paypal.sandbox)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.invoiceId.slice(0, 127),
          custom_id: params.invoiceId,
          invoice_id: params.invoiceNumber.slice(0, 127),
          amount: { currency_code: currency, value: params.amount.toFixed(2) },
        },
      ],
      application_context: {
        return_url: returns.successUrl,
        cancel_url: returns.cancelUrl,
        brand_name: "SchoolHub SA",
        user_action: "PAY_NOW",
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    links?: Array<{ rel: string; href: string }>;
  };
  if (!res.ok || !data.id) {
    return { configured: true as const, paymentUrl: null as string | null, message: "Could not create PayPal order" };
  }
  const approval = data.links?.find((link) => link.rel === "approve")?.href;
  return {
    configured: true as const,
    orderId: data.id,
    status: data.status,
    paymentUrl: approval ?? null,
    sandbox: config.paypal.sandbox,
  };
}

export async function getPayPalOrder(config: ResolvedIntegrations, orderId: string) {
  const token = await paypalAccessToken(config);
  if (!token) return null;
  const res = await fetch(`${paypalBase(config.paypal.sandbox)}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{ custom_id?: string; amount?: { value?: string } }>;
  };
}

export async function capturePayPalOrder(config: ResolvedIntegrations, orderId: string) {
  const token = await paypalAccessToken(config);
  if (!token) return null;
  const res = await fetch(`${paypalBase(config.paypal.sandbox)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id?: string; status?: string };
}
