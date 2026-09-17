const WEAK_SECRETS = new Set([
  "",
  "change-me",
  "schoolhub-dev-secret-change-in-production",
]);

export const DEV_JWT_FALLBACK = "schoolhub-dev-secret-change-in-production";

export function isWeakAuthSecret(value: string | undefined | null): boolean {
  if (!value) return true;
  return WEAK_SECRETS.has(value.trim());
}

/** JWT / secret-crypto key material. Production refuses known placeholders. */
export function resolveAuthSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!isWeakAuthSecret(secret)) return secret!;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong random value in production");
  }
  return DEV_JWT_FALLBACK;
}
