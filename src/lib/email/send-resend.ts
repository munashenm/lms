import { Resend } from "resend";
import { sanitizeEmailDetail } from "./sanitize";

export interface ResendSendPayload {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename?: string; content?: string; contentType?: string }[];
}

export interface ResendSendResult {
  data: { id: string } | null;
  error: { message: string; statusCode?: number | null; name?: string } | null;
}

export interface ResendEmailClient {
  emails: {
    send: (payload: ResendSendPayload) => Promise<ResendSendResult>;
  };
}

export interface ResendMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; type: string; contentBase64: string }[];
}

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
}

export interface ProviderSendResult {
  sent: boolean;
  messageId: string | null;
  reason?: string;
  httpStatus?: number | null;
}

function formatFrom(fromEmail: string, fromName: string): string {
  const name = fromName.trim();
  if (!name) return fromEmail;
  return `${name} <${fromEmail}>`;
}

export async function sendEmailViaResend(
  config: ResendConfig,
  message: ResendMessage,
  client?: ResendEmailClient
): Promise<ProviderSendResult> {
  const payload: ResendSendPayload = {
    from: formatFrom(config.fromEmail, config.fromName),
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    ...(message.attachments?.length
      ? {
          attachments: message.attachments.map((file) => ({
            filename: file.filename,
            content: file.contentBase64,
            contentType: file.type,
          })),
        }
      : {}),
  };

  try {
    const { data, error } = client
      ? await client.emails.send(payload)
      : await new Resend(config.apiKey).emails.send({
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(config.replyTo ? { replyTo: config.replyTo } : {}),
          ...(payload.attachments ? { attachments: payload.attachments } : {}),
        });
    if (error) {
      return {
        sent: false,
        messageId: null,
        reason: sanitizeEmailDetail(error.message || "Resend rejected the message", [config.apiKey]),
        httpStatus: error.statusCode ?? null,
      };
    }
    return { sent: true, messageId: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resend request failed";
    return {
      sent: false,
      messageId: null,
      reason: sanitizeEmailDetail(message, [config.apiKey]),
    };
  }
}
