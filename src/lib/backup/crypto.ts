import crypto from "crypto";

const ALG = "aes-256-gcm";

export function deriveBackupKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function backupConfigurationError(): string | null {
  if (!process.env.BACKUP_ENCRYPTION_KEY?.trim()) {
    return "BACKUP_ENCRYPTION_KEY is not configured";
  }
  const provider = (process.env.BACKUP_STORAGE_PROVIDER || "local").toLowerCase();
  if (provider === "s3") {
    const ready = Boolean(
      process.env.BACKUP_S3_ENDPOINT &&
        process.env.BACKUP_S3_BUCKET &&
        process.env.BACKUP_S3_ACCESS_KEY_ID &&
        process.env.BACKUP_S3_SECRET_ACCESS_KEY
    );
    if (!ready) return "S3 backup storage is not fully configured";
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
