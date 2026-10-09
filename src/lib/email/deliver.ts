import { CommunicationStatus } from "@prisma/client";
import type { ResolvedIntegrations } from "../school-integrations";
import { sendEmailViaSendGrid } from "../outbound-messaging";
import {
  EMAIL_PROVIDER_NOT_CONFIGURED,
  type ResolvedEmailProvider,
} from "./resolve-provider";
import { sanitizeEmailDetail } from "./sanitize";
import { sendEmailViaResend, type ResendEmailClient } from "./send-resend";

export const SENT_TO_PROVIDER = "SENT_TO_PROVIDER" as const;

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; type: string; contentBase64: string }[];
}

export interface DeliverEmailResult {
  sent: boolean;
  provider: ResolvedEmailProvider["provider"];
  /** Provider API acceptance. Never means the message reached an inbox. */
  acceptance: typeof SENT_TO_PROVIDER | null;
  status: typeof CommunicationStatus.SENT | typeof CommunicationStatus.FAILED;
  messageId: string | null;
  reason?: string;
  httpStatus?: number | null;
  fromEmail: string;
  replyTo: string | null;
}

export interface EmailLogFields {
  status: typeof CommunicationStatus.SENT | typeof CommunicationStatus.FAILED;
  error: string | null;
  provider: string | null;
  providerMessageId: string | null;
  metadata: {
    providerAcceptance: typeof SENT_TO_PROVIDER | null;
    inboxDelivered: false;
  };
}

function failure(provider: ResolvedEmailProvider, reason: string, httpStatus?: number | null): DeliverEmailResult {
  return {
    sent: false,
    provider: provider.provider,
    acceptance: null,
    status: CommunicationStatus.FAILED,
    messageId: null,
    reason: sanitizeEmailDetail(reason, [provider.apiKey]),
    httpStatus: httpStatus ?? null,
    fromEmail: provider.fromEmail,
    replyTo: provider.replyTo,
  };
}

/**
 * Sends through the already-selected provider.
 * API acceptance is recorded as SENT_TO_PROVIDER. Inbox delivery requires a provider event,
 * which this path does not receive.
 */
export async function deliverEmail(
  provider: ResolvedEmailProvider,
  message: OutboundEmail,
  options?: { resendClient?: ResendEmailClient }
): Promise<DeliverEmailResult> {
  if (!provider.deliveryReady || !provider.apiKey) {
    return failure(provider, provider.failureCode ?? EMAIL_PROVIDER_NOT_CONFIGURED);
  }

  if (provider.provider === "RESEND") {
    const result = await sendEmailViaResend(
      {
        apiKey: provider.apiKey,
        fromEmail: provider.fromEmail,
        fromName: provider.fromName,
        replyTo: provider.replyTo,
      },
      message,
      options?.resendClient
    );
    if (!result.sent) return failure(provider, result.reason ?? "Resend request failed", result.httpStatus);
    return {
      sent: true,
      provider: "RESEND",
      acceptance: SENT_TO_PROVIDER,
      status: CommunicationStatus.SENT,
      messageId: result.messageId,
      fromEmail: provider.fromEmail,
      replyTo: provider.replyTo,
    };
  }

  if (provider.provider === "SENDGRID") {
    const sendgrid: ResolvedIntegrations["sendgrid"] = {
      enabled: true,
      apiKey: provider.apiKey,
      fromEmail: provider.fromEmail,
      fromName: provider.fromName,
      replyTo: provider.replyTo,
      source: "school",
      senderValid: true,
    };
    try {
      const result = await sendEmailViaSendGrid(
        { sendgrid } as ResolvedIntegrations,
        message.to,
        message.subject,
        message.text,
        message.attachments,
        message.html
      );
      if (!result.sent) return failure(provider, result.reason);
      return {
        sent: true,
        provider: "SENDGRID",
        acceptance: SENT_TO_PROVIDER,
        status: CommunicationStatus.SENT,
        messageId: result.messageId,
        fromEmail: provider.fromEmail,
        replyTo: provider.replyTo,
      };
    } catch (err) {
      const httpStatus =
        err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
          ? (err as { status: number }).status
          : null;
      const reason = err instanceof Error ? err.message : "SendGrid request failed";
      return failure(provider, reason, httpStatus);
    }
  }

  return failure(provider, EMAIL_PROVIDER_NOT_CONFIGURED);
}

export function toEmailLogFields(result: DeliverEmailResult): EmailLogFields {
  return {
    status: result.sent ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
    error: result.sent ? null : result.reason ?? EMAIL_PROVIDER_NOT_CONFIGURED,
    provider: result.provider === "NONE" ? null : result.provider.toLowerCase(),
    providerMessageId: result.messageId,
    metadata: {
      providerAcceptance: result.acceptance,
      inboxDelivered: false,
    },
  };
}
