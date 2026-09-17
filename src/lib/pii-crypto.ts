import crypto from "crypto";
import { resolveAuthSecret } from "./auth-secret";
import { decryptSecret, encryptSecret } from "./secret-crypto";

export const ENCRYPTED_SECRET_PREFIX = "enc:v1:";

export function normalizeSaId(value: string): string {
  return value.replace(/\D/g, "");
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

export function hashSaId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeSaId(value);
  if (!normalized) return null;
  return crypto.createHmac("sha256", resolveAuthSecret()).update(normalized).digest("hex");
}

export function sealSaId(value: string | null | undefined): {
  stored: string | null;
  hash: string | null;
} {
  if (value == null || value === "") return { stored: null, hash: null };
  if (isEncryptedSecret(value)) {
    const plain = decryptSecret(value);
    return { stored: value, hash: hashSaId(plain) };
  }
  const normalized = normalizeSaId(value) || value.trim();
  return {
    stored: encryptSecret(normalized),
    hash: hashSaId(normalized),
  };
}

export function revealSaId(value: string | null | undefined): string | null {
  if (!value) return null;
  return decryptSecret(value);
}

export function saIdLookupClause(value: string | null | undefined): {
  OR: Array<{ saIdNumberHash?: string; saIdNumber?: string | null }>;
} | { saIdNumber: null; saIdNumberHash: null } {
  if (value == null || value === "") {
    return { saIdNumber: null, saIdNumberHash: null };
  }
  const hash = hashSaId(value);
  return {
    OR: [...(hash ? [{ saIdNumberHash: hash }] : []), { saIdNumber: value }],
  };
}
