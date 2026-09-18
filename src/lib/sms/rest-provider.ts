import type { ResolvedIntegrations } from "../school-integrations";
import { normalizeZaPhone, type SmsProvider, type SmsSendResult } from "./provider";

export function createRestSmsProvider(config: ResolvedIntegrations): SmsProvider {
  return {
    name: "generic-rest",
    async send(to: string, body: string): Promise<SmsSendResult> {
      const url = config.sms.restUrl;
      const apiKey = config.sms.restApiKey;
      if (!url || !apiKey) {
        return { sent: false, provider: "generic-rest", reason: "not_configured" };
      }
      const method = (config.sms.restMethod || "POST").toUpperCase();
      const payload = (config.sms.restBodyTemplate || '{"to":"{{to}}","from":"{{from}}","body":"{{body}}"}')
        .replaceAll("{{to}}", normalizeZaPhone(to))
        .replaceAll("{{from}}", config.sms.restFrom ?? "")
        .replaceAll("{{body}}", body.slice(0, 1600))
        .replaceAll("{{apiKey}}", apiKey);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.sms.restAuthHeader) {
        headers[config.sms.restAuthHeader.split(":")[0]?.trim() || "Authorization"] =
          config.sms.restAuthHeader.includes(":")
            ? config.sms.restAuthHeader.slice(config.sms.restAuthHeader.indexOf(":") + 1).trim().replaceAll("{{apiKey}}", apiKey)
            : `Bearer ${apiKey}`;
      } else {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const res = await fetch(url, { method, headers, body: method === "GET" ? undefined : payload });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { sent: false, provider: "generic-rest", reason: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string; sid?: string };
      return { sent: true, provider: "generic-rest", externalId: data.id ?? data.messageId ?? data.sid };
    },
  };
}
