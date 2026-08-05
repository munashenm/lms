export type SmsSendResult =
  | { sent: true; provider: string; externalId?: string }
  | { sent: false; provider: string; reason: string };

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsSendResult>;
}

export function normalizeZaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("27")) return `+${digits}`;
  if (digits.startsWith("0")) return `+27${digits.slice(1)}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
