const PLACEHOLDER_FROM = "noreply@schoolhub.local";

export type SendGridCredentialSource = "school" | "platform" | "none";

export interface SendGridResolutionInput {
  schoolEnabled: boolean;
  schoolApiKey: string | null;
  schoolFromEmail: string | null;
  schoolFromName: string | null;
  schoolReplyTo: string | null;
  envApiKey: string | null;
  envFromEmail: string | null;
  envFromName: string | null;
  envReplyTo: string | null;
}

export interface ResolvedSendGrid {
  enabled: boolean;
  apiKey: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  source: SendGridCredentialSource;
  senderValid: boolean;
}

/** A real mailbox. The local placeholder is never treated as a production sender. */
export function isDeliverableSender(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  if (!value || value === PLACEHOLDER_FROM) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firstDeliverable(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (isDeliverableSender(candidate)) return candidate!.trim();
  }
  return null;
}

/**
 * School-stored SendGrid credentials win when that school has enabled them.
 * Otherwise the platform environment variables are used. A saved integration
 * row with no key must not hide the platform key.
 */
export function resolveSendGrid(input: SendGridResolutionInput): ResolvedSendGrid {
  const schoolKey = input.schoolApiKey?.trim() || null;
  const envKey = input.envApiKey?.trim() || null;
  const useSchool = Boolean(input.schoolEnabled && schoolKey);
  const schoolDisabledOwnKey = !input.schoolEnabled && Boolean(schoolKey);
  const usePlatform = !useSchool && !schoolDisabledOwnKey && Boolean(envKey);
  const source: SendGridCredentialSource = useSchool ? "school" : usePlatform ? "platform" : "none";
  const fromEmail =
    firstDeliverable(input.schoolFromEmail, input.envFromEmail) ??
    (input.schoolFromEmail?.trim() || input.envFromEmail?.trim() || PLACEHOLDER_FROM);
  const fromName =
    input.schoolFromName?.trim() || input.envFromName?.trim() || "SchoolHub SA";
  const replyTo = firstDeliverable(input.envReplyTo, input.schoolReplyTo);

  return {
    enabled: source !== "none",
    apiKey: useSchool ? schoolKey : usePlatform ? envKey : null,
    fromEmail,
    fromName,
    replyTo,
    source,
    senderValid: isDeliverableSender(fromEmail),
  };
}

export function sendGridDeliveryReady(config: ResolvedSendGrid): boolean {
  return Boolean(config.enabled && config.apiKey && config.senderValid);
}
