import crypto from "crypto";
import type { ResolvedIntegrations } from "../school-integrations";
import { isPayFastReady } from "../school-integrations";

interface PayFastPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  studentEmail?: string;
  studentName: string;
}

export function isPayFastConfigured(config: ResolvedIntegrations) {
  return isPayFastReady(config);
}

export function createPayFastPayment(
  config: ResolvedIntegrations,
  params: PayFastPaymentParams
) {
  const merchantId = config.payfast.merchantId;
  const merchantKey = config.payfast.merchantKey;
  const passphrase = config.payfast.passphrase;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const sandbox = config.payfast.sandbox;

  if (!merchantId || !merchantKey || !passphrase) {
    return { configured: false as const };
  }

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appUrl}/student/fees/${params.invoiceId}?paid=1`,
    cancel_url: `${appUrl}/student/fees/${params.invoiceId}?cancelled=1`,
    notify_url: `${appUrl}/api/webhooks/payfast`,
    name_first: params.studentName.split(" ")[0] ?? "Student",
    name_last: params.studentName.split(" ").slice(1).join(" ") || "User",
    email_address: params.studentEmail ?? "student@college.co.za",
    m_payment_id: params.invoiceId,
    amount: params.amount.toFixed(2),
    item_name: `SchoolHub SA — ${params.invoiceNumber}`,
    item_description: `Fee payment for ${params.invoiceNumber}`,
  };

  const query = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const signature = crypto
    .createHash("md5")
    .update(`${query}&passphrase=${encodeURIComponent(passphrase)}`)
    .digest("hex");

  const baseUrl = sandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  return {
    configured: true as const,
    paymentUrl: `${baseUrl}?${query}&signature=${signature}`,
    sandbox,
  };
}
