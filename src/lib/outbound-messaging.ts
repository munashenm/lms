import type { ResolvedIntegrations } from "./school-integrations";
import { sanitizeEmailDetail } from "./email/sanitize";

export async function sendEmailViaSendGrid(
  config: ResolvedIntegrations,
  to: string,
  subject: string,
  body: string,
  attachments?: { filename: string; type: string; contentBase64: string }[],
  html?: string
) {
  const apiKey = config.sendgrid.apiKey;
  if (!apiKey) return { sent: false as const, reason: "not_configured" };
  if (!config.sendgrid.senderValid) return { sent: false as const, reason: "invalid_sender" };

  const content = html
    ? [
        { type: "text/plain", value: body },
        { type: "text/html", value: html },
      ]
    : [{ type: "text/plain", value: body }];

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: {
        email: config.sendgrid.fromEmail,
        name: config.sendgrid.fromName,
      },
      ...(config.sendgrid.replyTo ? { reply_to: { email: config.sendgrid.replyTo } } : {}),
      subject,
      content,
      ...(attachments?.length
        ? {
            attachments: attachments.map((a) => ({
              content: a.contentBase64,
              filename: a.filename,
              type: a.type,
              disposition: "attachment",
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const error = new Error(`SendGrid ${res.status}: ${sanitizeEmailDetail(detail, [apiKey])}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return { sent: true as const, messageId: res.headers.get("x-message-id") };
}

export async function sendSmsViaTwilio(
  config: ResolvedIntegrations,
  to: string,
  body: string
) {
  const accountSid = config.twilio.accountSid;
  const authToken = config.twilio.authToken;
  const from = config.twilio.fromNumber;

  if (!accountSid || !authToken || !from) {
    return { sent: false as const, reason: "not_configured" };
  }

  const normalized = normalizeZaPhone(to);
  const params = new URLSearchParams({
    To: normalized,
    From: from,
    Body: body.slice(0, 1600),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${detail.slice(0, 200)}`);
  }

  return { sent: true as const };
}

function normalizeZaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("27")) return `+${digits}`;
  if (digits.startsWith("0")) return `+27${digits.slice(1)}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
