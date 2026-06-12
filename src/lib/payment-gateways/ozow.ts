import crypto from "crypto";

interface OzowPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
}

export function isOzowConfigured() {
  return Boolean(
    process.env.OZOW_SITE_CODE &&
      process.env.OZOW_PRIVATE_KEY
  );
}

function ozowHash(values: string[], privateKey: string) {
  const input = `${values.join("").toLowerCase()}${privateKey.toLowerCase()}`;
  return crypto.createHash("sha512").update(input).digest("hex");
}

export function createOzowPayment(params: OzowPaymentParams) {
  const siteCode = process.env.OZOW_SITE_CODE;
  const privateKey = process.env.OZOW_PRIVATE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const sandbox = process.env.OZOW_SANDBOX !== "false";
  const baseUrl = sandbox
    ? "https://pay.ozow.com"
    : "https://pay.ozow.com";

  if (!siteCode || !privateKey) {
    return { configured: false as const };
  }

  const amount = params.amount.toFixed(2);
  const reference = params.invoiceId;
  const bankReference = params.invoiceNumber.slice(0, 20);
  const isTest = sandbox ? "true" : "false";

  const cancelUrl = `${appUrl}/student/fees/${params.invoiceId}?cancelled=1`;
  const errorUrl = `${appUrl}/student/fees/${params.invoiceId}?error=1`;
  const successUrl = `${appUrl}/student/fees/${params.invoiceId}?paid=1`;
  const notifyUrl = `${appUrl}/api/webhooks/ozow`;

  const hashCheck = ozowHash(
    [
      siteCode,
      "ZA",
      "ZAR",
      amount,
      reference,
      bankReference,
      "",
      "",
      "",
      "",
      "",
      "",
      cancelUrl,
      errorUrl,
      successUrl,
      notifyUrl,
      isTest,
    ],
    privateKey
  );

  const query = new URLSearchParams({
    SiteCode: siteCode,
    CountryCode: "ZA",
    CurrencyCode: "ZAR",
    Amount: amount,
    TransactionReference: reference,
    BankReference: bankReference,
    CancelUrl: cancelUrl,
    ErrorUrl: errorUrl,
    SuccessUrl: successUrl,
    NotifyUrl: notifyUrl,
    IsTest: isTest,
    HashCheck: hashCheck,
  });

  return {
    configured: true as const,
    paymentUrl: `${baseUrl}?${query.toString()}`,
    sandbox,
  };
}

export function verifyOzowNotifyHash(
  fields: {
    SiteCode: string;
    TransactionId: string;
    TransactionReference: string;
    Amount: string;
    Status: string;
    Optional1?: string;
    Optional2?: string;
    Optional3?: string;
    Optional4?: string;
    Optional5?: string;
    CurrencyCode?: string;
    IsTest?: string;
    StatusMessage?: string;
  },
  hash: string
) {
  const privateKey = process.env.OZOW_PRIVATE_KEY;
  if (!privateKey) return false;

  const expected = ozowHash(
    [
      fields.SiteCode,
      fields.TransactionId,
      fields.TransactionReference,
      fields.Amount,
      fields.Status,
      fields.Optional1 ?? "",
      fields.Optional2 ?? "",
      fields.Optional3 ?? "",
      fields.Optional4 ?? "",
      fields.Optional5 ?? "",
      fields.CurrencyCode ?? "ZAR",
      fields.IsTest ?? "false",
      fields.StatusMessage ?? "",
    ],
    privateKey
  );

  return expected.toLowerCase() === hash.toLowerCase();
}
