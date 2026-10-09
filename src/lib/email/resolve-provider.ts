import { isDeliverableSender } from "./resolve-sendgrid";

export type EmailProviderName = "RESEND" | "SENDGRID" | "NONE";

export const EMAIL_PROVIDER_NOT_CONFIGURED = "EMAIL_PROVIDER_NOT_CONFIGURED";

export interface EmailProviderInput {
  schoolEnabled: boolean;
  schoolApiKey: string | null;
  schoolFromEmail: string | null;
  schoolFromName: string | null;
  schoolReplyTo: string | null;
  sendGridReplyTo: string | null;
  resendApiKey: string | null;
  resendFromEmail: string | null;
  resendFromName: string | null;
  resendReplyTo: string | null;
}

export interface ResolvedEmailProvider {
  provider: EmailProviderName;
  /** A provider key is present for the selected route. */
  configured: boolean;
  /** The From address that would be used is a real mailbox. */
  senderValid: boolean;
  /** Safe to attempt a send. */
  deliveryReady: boolean;
  apiKey: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  failureCode: typeof EMAIL_PROVIDER_NOT_CONFIGURED | "invalid_sender" | null;
}

export interface PublicEmailProviderStatus {
  provider: EmailProviderName;
  configured: boolean;
  senderValid: boolean;
  deliveryReady: boolean;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
}

function blank(provider: EmailProviderName, failureCode: ResolvedEmailProvider["failureCode"]): ResolvedEmailProvider {
  return {
    provider,
    configured: false,
    senderValid: false,
    deliveryReady: false,
    apiKey: null,
    fromEmail: "",
    fromName: "",
    replyTo: null,
    failureCode,
  };
}

function deliverableReply(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (isDeliverableSender(candidate)) return candidate!.trim();
  }
  return null;
}

/**
 * School SendGrid is used only when that school has enabled a key and its own
 * deliverable From address. A disabled or incomplete school row falls through
 * to platform Resend. Platform SendGrid environment variables are not a send path.
 */
export function resolveEmailProvider(input: EmailProviderInput): ResolvedEmailProvider {
  const schoolKey = input.schoolApiKey?.trim() || null;
  const schoolFrom = input.schoolFromEmail?.trim() || "";
  const schoolReady = Boolean(input.schoolEnabled && schoolKey && isDeliverableSender(schoolFrom));

  if (schoolReady) {
    return {
      provider: "SENDGRID",
      configured: true,
      senderValid: true,
      deliveryReady: true,
      apiKey: schoolKey,
      fromEmail: schoolFrom,
      fromName: input.schoolFromName?.trim() || "SchoolHub SA",
      replyTo: deliverableReply(input.sendGridReplyTo, input.schoolReplyTo),
      failureCode: null,
    };
  }

  const resendKey = input.resendApiKey?.trim() || null;
  const resendFrom = input.resendFromEmail?.trim() || "";
  const resendSenderValid = isDeliverableSender(resendFrom);

  if (resendKey && resendSenderValid) {
    return {
      provider: "RESEND",
      configured: true,
      senderValid: true,
      deliveryReady: true,
      apiKey: resendKey,
      fromEmail: resendFrom,
      fromName: input.resendFromName?.trim() || "SchoolHub SA",
      replyTo: deliverableReply(input.resendReplyTo),
      failureCode: null,
    };
  }

  if (resendKey && !resendSenderValid) {
    return {
      provider: "RESEND",
      configured: true,
      senderValid: false,
      deliveryReady: false,
      apiKey: null,
      fromEmail: resendFrom,
      fromName: input.resendFromName?.trim() || "SchoolHub SA",
      replyTo: deliverableReply(input.resendReplyTo),
      failureCode: "invalid_sender",
    };
  }

  if (input.schoolEnabled && schoolKey && !isDeliverableSender(schoolFrom)) {
    return {
      provider: "SENDGRID",
      configured: true,
      senderValid: false,
      deliveryReady: false,
      apiKey: null,
      fromEmail: schoolFrom,
      fromName: input.schoolFromName?.trim() || "SchoolHub SA",
      replyTo: deliverableReply(input.sendGridReplyTo, input.schoolReplyTo),
      failureCode: "invalid_sender",
    };
  }

  return blank("NONE", EMAIL_PROVIDER_NOT_CONFIGURED);
}

/** Status safe to return to an admin UI. The API key is not a field. */
export function publicEmailProviderStatus(resolved: ResolvedEmailProvider): PublicEmailProviderStatus {
  return {
    provider: resolved.provider,
    configured: resolved.configured,
    senderValid: resolved.senderValid,
    deliveryReady: resolved.deliveryReady,
    fromEmail: resolved.fromEmail,
    fromName: resolved.fromName,
    replyTo: resolved.replyTo,
  };
}

export function platformResendEnv(env: NodeJS.ProcessEnv = process.env): Pick<
  EmailProviderInput,
  "resendApiKey" | "resendFromEmail" | "resendFromName" | "resendReplyTo"
> {
  return {
    resendApiKey: env.RESEND_API_KEY ?? null,
    resendFromEmail: env.RESEND_FROM_EMAIL ?? null,
    resendFromName: env.RESEND_FROM_NAME ?? null,
    resendReplyTo: env.RESEND_REPLY_TO ?? null,
  };
}
