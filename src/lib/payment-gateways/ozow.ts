import crypto from "crypto";
import type { ResolvedIntegrations } from "../school-integrations";
import { isOzowReady } from "../school-integrations";
import { UserRole } from "@prisma/client";
import { paymentReturnUrls } from "./return-url";

interface OzowPaymentParams {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  role?: UserRole;
}

export function isOzowConfigured(config: ResolvedIntegrations) {
  return isOzowReady(config);
}

function ozowHash(values: string[], privateKey: string) {
  const input = `${values.join("").toLowerCase()}${privateKey.toLowerCase()}`;
  return crypto.createHash("sha512").update(input).digest("hex");
}

export function createOzowPayment(config: ResolvedIntegrations, params: OzowPaymentParams) {
  const siteCode = config.ozow.siteCode;
  const privateKey = config.ozow.privateKey;
  const sandbox = config.ozow.sandbox;
  const baseUrl = "https://pay.ozow.com";
  const returns = paymentReturnUrls(params.role ?? UserRole.STUDENT, params.invoiceId);

  if (!siteCode || !privateKey) {
    return { configured: false as const };
  }

  const amount = params.amount.toFixed(2);
  const reference = params.invoiceId;
  const bankReference = params.invoiceNumber.slice(0, 20);
  const isTest = sandbox ? "true" : "false";

  const cancelUrl = returns.cancelUrl;
  const errorUrl = returns.failureUrl;
  const successUrl = returns.successUrl;
  const notifyUrl = `${returns.appUrl}/api/webhooks/ozow`;

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
  privateKey: string,
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
