import type { ResolvedIntegrations } from "../school-integrations";
import { normalizeZaPhone, type SmsProvider, type SmsSendResult } from "./provider";

export function createTwilioSmsProvider(config: ResolvedIntegrations): SmsProvider {
  return {
    name: "twilio",
    async send(to: string, body: string): Promise<SmsSendResult> {
      const accountSid = config.twilio.accountSid;
      const authToken = config.twilio.authToken;
      const from = config.twilio.fromNumber;

      if (!config.twilio.enabled || !accountSid || !authToken || !from) {
        return { sent: false, provider: "twilio", reason: "not_configured" };
      }

      const params = new URLSearchParams({
        To: normalizeZaPhone(to),
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
        return {
          sent: false,
          provider: "twilio",
          reason: `Twilio ${res.status}: ${detail.slice(0, 200)}`,
        };
      }

      const data = (await res.json().catch(() => ({}))) as { sid?: string };
      return { sent: true, provider: "twilio", externalId: data.sid };
    },
  };
}
