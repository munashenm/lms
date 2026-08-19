import { mkdir, rm, writeFile, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ALLOWED_IMPORT_EXT, ALLOWED_IMPORT_MIME, MAX_IMPORT_BYTES } from "./types";
import { encryptBytes, decryptBytes, deriveBackupKey } from "@/lib/backup/crypto";

export function importRoot(): string {
  const configured = process.env.IMPORT_TEMP_DIR;
  if (configured) return configured;
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "imports");
}

export function getImportEncryptionKey(): Buffer {
  const secret = process.env.IMPORT_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error("IMPORT_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY is required");
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  return deriveBackupKey(secret);
}

export function validateUpload(filename: string, mimeType: string | null, size: number): string | null {
  if (size <= 0) return "The uploaded file is empty.";
  if (size > MAX_IMPORT_BYTES) return `File exceeds the maximum size of ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`;
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_IMPORT_EXT.includes(ext)) {
    return `File type ${ext || "(none)"} is not allowed. Use CSV, TSV, JSON, XLSX, or a native SA-SAMS database file (.mdb, .accdb, .bak).`;
  }
  if (mimeType && !ALLOWED_IMPORT_MIME.includes(mimeType) && mimeType !== "application/octet-stream") {
    return "This MIME type is not accepted for SA-SAMS imports.";
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return "Filename is not allowed.";
  }
  return null;
}

export async function storeEncryptedImport(schoolId: string, jobId: string, bytes: Buffer): Promise<string> {
  const dir = path.join(importRoot(), schoolId);
  await mkdir(dir, { recursive: true });
  const key = getImportEncryptionKey();
  const { ciphertext, iv, authTag } = encryptBytes(bytes, key);
  const packed = Buffer.concat([iv, authTag, ciphertext]);
  const dest = path.join(dir, `${jobId}.enc`);
  await writeFile(dest, packed, { mode: 0o600 });
  return dest;
}

export async function readEncryptedImport(storageKey: string): Promise<Buffer> {
  const buf = await readFile(storageKey);
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  return decryptBytes(ciphertext, getImportEncryptionKey(), iv, authTag);
}

export async function deleteImportFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  await rm(storageKey, { force: true });
}

export async function cleanupExpiredImportFiles(before: Date) {
  const { prisma } = await import("@/lib/db");
  const expired = await prisma.importJob.findMany({
    where: { expiresAt: { lte: before }, encryptedStorageKey: { not: null } },
    select: { id: true, encryptedStorageKey: true },
  });
  for (const job of expired) {
    await deleteImportFile(job.encryptedStorageKey);
    await prisma.importJob.update({
      where: { id: job.id },
      data: { encryptedStorageKey: null },
    });
  }
  return expired.length;
}

export function safeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export function looksExecutable(bytes: Buffer): boolean {
  const magic = bytes.subarray(0, 4);
  if (magic[0] === 0x7f && magic.toString("ascii", 1, 4) === "ELF") return true;
  if (magic[0] === 0x4d && magic[1] === 0x5a) return true;
  if (bytes.subarray(0, 2).toString() === "#!") return true;
  return false;
}

export function randomToken(): string {
  return crypto.randomBytes(16).toString("hex");
}
