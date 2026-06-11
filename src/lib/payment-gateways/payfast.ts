import crypto from "crypto";

interface PayFastPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  studentEmail?: string;
  studentName: string;
}

export function isPayFastConfigured() {
  return Boolean(
    process.env.PAYFAST_MERCHANT_ID &&
      process.env.PAYFAST_MERCHANT_KEY &&
      process.env.PAYFAST_PASSPHRASE
  );
}

export function createPayFastPayment(params: PayFastPaymentParams) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const sandbox = process.env.PAYFAST_SANDBOX !== "false";

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
