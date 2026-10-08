import crypto from "crypto";

const ALG = "aes-256-gcm";

export function deriveBackupKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function backupStorageProviderName(): "local" | "s3" {
  return (process.env.BACKUP_STORAGE_PROVIDER || "local").toLowerCase() === "s3" ? "s3" : "local";
}

/** True when production is using durable S3-compatible backup storage. */
export function isDurableBackupStorageConfigured(): boolean {
  if (backupStorageProviderName() !== "s3") return false;
  return Boolean(
    process.env.BACKUP_S3_ENDPOINT &&
      process.env.BACKUP_S3_BUCKET &&
      process.env.BACKUP_S3_ACCESS_KEY_ID &&
      process.env.BACKUP_S3_SECRET_ACCESS_KEY
  );
}

export function backupConfigurationError(): string | null {
  if (!process.env.BACKUP_ENCRYPTION_KEY?.trim()) {
    return "BACKUP_ENCRYPTION_KEY is not configured";
  }
  const provider = backupStorageProviderName();
  if (provider === "s3") {
    if (!isDurableBackupStorageConfigured()) {
      return "S3 backup storage is not fully configured";
    }
    return null;
  }
  // Local filesystem backups are fine for development. Production needs S3 (or an
  // explicit override when a persistent volume is mounted and operators accept the risk).
  if (process.env.NODE_ENV === "production" && process.env.BACKUP_ALLOW_LOCAL !== "true") {
    return "Production backups require BACKUP_STORAGE_PROVIDER=s3 (or BACKUP_ALLOW_LOCAL=true with a mounted volume)";
  }
  return null;
}

export function getBackupEncryptionKey(): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not configured");
  }
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  return deriveBackupKey(secret);
}

export function encryptBytes(
  plaintext: Buffer,
  key: Buffer
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptBytes(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
