const SENDGRID_FROM = process.env.SENDGRID_FROM_EMAIL ?? "noreply@schoolhub.local";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "SchoolHub SA";

export async function sendEmailViaSendGrid(to: string, subject: string, body: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { sent: false as const, reason: "not_configured" };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM, name: SENDGRID_FROM_NAME },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SendGrid ${res.status}: ${detail.slice(0, 200)}`);
  }

  return { sent: true as const };
}

export async function sendSmsViaTwilio(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

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
