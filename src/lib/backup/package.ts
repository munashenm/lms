import { BACKUP_FORMAT_VERSION, BACKUP_MAGIC, type BackupManifest } from "./types";
import { decryptBytes, encryptBytes, sha256Hex } from "./crypto";

function writeUInt32BE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

export function packBackup(plaintext: Buffer, key: Buffer, manifestBase: Omit<BackupManifest, "checksum" | "encryption">): Buffer {
  const { ciphertext, iv, authTag } = encryptBytes(plaintext, key);
  const checksum = sha256Hex(ciphertext);
  const manifest: BackupManifest = {
    ...manifestBase,
    checksum,
    encryption: {
      alg: "aes-256-gcm",
      kdf: "sha256",
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    },
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");
  const magic = Buffer.from(BACKUP_MAGIC, "utf8");
  const version = Buffer.alloc(2);
  version.writeUInt16BE(BACKUP_FORMAT_VERSION);
  return Buffer.concat([magic, version, writeUInt32BE(manifestBuf.length), manifestBuf, ciphertext]);
}

export type UnpackResult =
  | { ok: true; manifest: BackupManifest; plaintext: Buffer }
  | { ok: false; error: "magic" | "version" | "checksum" | "decrypt" | "compat" | "truncated" };

export function unpackBackup(pkg: Buffer, key: Buffer, minCompat = 1): UnpackResult {
  const magicLen = BACKUP_MAGIC.length;
  if (pkg.length < magicLen + 6) return { ok: false, error: "truncated" };
  if (pkg.subarray(0, magicLen).toString("utf8") !== BACKUP_MAGIC) {
    return { ok: false, error: "magic" };
  }
  const version = pkg.readUInt16BE(magicLen);
  if (version !== BACKUP_FORMAT_VERSION) return { ok: false, error: "version" };
  const manifestLen = pkg.readUInt32BE(magicLen + 2);
  const manifestStart = magicLen + 6;
  const manifestEnd = manifestStart + manifestLen;
  if (pkg.length < manifestEnd) return { ok: false, error: "truncated" };
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(pkg.subarray(manifestStart, manifestEnd).toString("utf8")) as BackupManifest;
  } catch {
    return { ok: false, error: "truncated" };
  }
  if (manifest.compatibilityVersion > minCompat + 10 && manifest.compatibilityVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: "compat" };
  }
  const ciphertext = pkg.subarray(manifestEnd);
  if (sha256Hex(ciphertext) !== manifest.checksum) {
    return { ok: false, error: "checksum" };
  }
  try {
    const plaintext = decryptBytes(
      ciphertext,
      key,
      Buffer.from(manifest.encryption.iv, "base64"),
      Buffer.from(manifest.encryption.authTag, "base64")
    );
    return { ok: true, manifest, plaintext };
  } catch {
    return { ok: false, error: "decrypt" };
  }
}

export function verifyBackupIntegrity(pkg: Buffer): { ok: boolean; error?: string; manifest?: BackupManifest } {
  const magicLen = BACKUP_MAGIC.length;
  if (pkg.length < magicLen + 6) return { ok: false, error: "File is too small to be a valid backup" };
  if (pkg.subarray(0, magicLen).toString("utf8") !== BACKUP_MAGIC) {
    return { ok: false, error: "Unrecognised backup format" };
  }
  const manifestLen = pkg.readUInt32BE(magicLen + 2);
  const manifestStart = magicLen + 6;
  const manifestEnd = manifestStart + manifestLen;
  if (pkg.length < manifestEnd) return { ok: false, error: "Backup file is truncated" };
  try {
    const manifest = JSON.parse(pkg.subarray(manifestStart, manifestEnd).toString("utf8")) as BackupManifest;
    const ciphertext = pkg.subarray(manifestEnd);
    if (sha256Hex(ciphertext) !== manifest.checksum) {
      return { ok: false, error: "Backup checksum mismatch — file may be corrupt" };
    }
    return { ok: true, manifest };
  } catch {
    return { ok: false, error: "Backup manifest is not valid JSON" };
  }
}
