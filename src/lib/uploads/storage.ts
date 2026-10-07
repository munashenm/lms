import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { BackupStorageProvider } from "@/lib/backup/storage/types";
import { S3BackupStorage } from "@/lib/backup/storage/s3";
import { parseUploadPath } from "@/lib/upload-path";

/**
 * Durable upload storage for school-owned files.
 * Keys are always `uploads/{schoolId}/...` so URLs stay `/uploads/{schoolId}/...`.
 * Local development writes under `public/uploads`. Production should use S3
 * (may reuse BACKUP_S3_* credentials when UPLOAD_S3_* are unset).
 */

export function uploadStorageProviderName(): "local" | "s3" {
  const explicit = (process.env.UPLOAD_STORAGE_PROVIDER || "").toLowerCase();
  if (explicit === "s3" || explicit === "local") return explicit;
  // Default: follow backup provider so one S3 bucket config covers both.
  return (process.env.BACKUP_STORAGE_PROVIDER || "local").toLowerCase() === "s3" ? "s3" : "local";
}

function s3Env(name: "ENDPOINT" | "BUCKET" | "ACCESS_KEY_ID" | "SECRET_ACCESS_KEY" | "REGION") {
  const uploadKey = `UPLOAD_S3_${name}`;
  const backupKey = `BACKUP_S3_${name}`;
  return process.env[uploadKey] || process.env[backupKey] || "";
}

export function isDurableUploadStorageConfigured(): boolean {
  if (uploadStorageProviderName() !== "s3") return false;
  return Boolean(
    s3Env("ENDPOINT") && s3Env("BUCKET") && s3Env("ACCESS_KEY_ID") && s3Env("SECRET_ACCESS_KEY")
  );
}

export function uploadStorageConfigurationError(): string | null {
  const provider = uploadStorageProviderName();
  if (provider === "s3") {
    if (!isDurableUploadStorageConfigured()) {
      return "S3 upload storage is not fully configured (set UPLOAD_S3_* or reuse BACKUP_S3_*)";
    }
    return null;
  }
  if (process.env.NODE_ENV === "production" && process.env.UPLOAD_ALLOW_LOCAL !== "true") {
    return "Production uploads require UPLOAD_STORAGE_PROVIDER=s3 (or UPLOAD_ALLOW_LOCAL=true with a mounted volume)";
  }
  return null;
}

function createS3UploadStorage(): S3BackupStorage {
  const endpoint = s3Env("ENDPOINT");
  const bucket = s3Env("BUCKET");
  const accessKeyId = s3Env("ACCESS_KEY_ID");
  const secretAccessKey = s3Env("SECRET_ACCESS_KEY");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 upload storage is not fully configured");
  }
  return new S3BackupStorage({
    endpoint,
    region: s3Env("REGION") || process.env.BACKUP_S3_REGION || "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle:
      (process.env.UPLOAD_S3_FORCE_PATH_STYLE || process.env.BACKUP_S3_FORCE_PATH_STYLE) !== "false",
  });
}

class LocalUploadStorage implements BackupStorageProvider {
  readonly name = "local";

  constructor(private readonly root = path.join(process.cwd(), "public")) {}

  private full(key: string): string {
    const safe = key.replace(/\0/g, "").replace(/^\/+/, "");
    const resolved = path.resolve(this.root, safe);
    const root = path.resolve(this.root);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(key: string, body: Buffer): Promise<{ key: string; size: number }> {
    const dest = this.full(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return { key, size: body.length };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    const { rm } = await import("fs/promises");
    await rm(this.full(key), { force: true });
  }

  async list(prefix: string): Promise<{ key: string; size: number }[]> {
    const out: { key: string; size: number }[] = [];
    const start = this.full(prefix);
    await walk(start, async (full) => {
      const info = await stat(full);
      if (!info.isFile()) return;
      const rel = path.relative(this.root, full).replace(/\\/g, "/");
      out.push({ key: rel, size: info.size });
    });
    return out;
  }
}

async function walk(current: string, onFile: (full: string) => Promise<void>) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(full, onFile);
    } else if (entry.isFile()) {
      await onFile(full);
    }
  }
}

let cached: BackupStorageProvider | null = null;
let cachedName: string | null = null;

export function getUploadStorage(): BackupStorageProvider {
  const name = uploadStorageProviderName();
  if (cached && cachedName === name) return cached;
  cached =
    name === "s3"
      ? createS3UploadStorage()
      : new LocalUploadStorage();
  cachedName = name;
  return cached;
}

/** Reset cache (tests). */
export function resetUploadStorageCache() {
  cached = null;
  cachedName = null;
}

export function objectKeyFromUploadPathname(pathname: string): string | null {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return null;
  return `uploads/${parsed.schoolId}/${parsed.rest}`;
}

export function publicUrlFromObjectKey(key: string): string | null {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return null;
  return `/${normalized}`;
}

export async function putSchoolUpload(opts: {
  schoolId: string;
  /** Path under the school folder, e.g. `branding/logo.png` or `students/abc/id.pdf` */
  relativePath: string;
  body: Buffer;
  contentType?: string;
}): Promise<string> {
  const relative = opts.relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!relative || relative.includes("..") || relative.includes("\0")) {
    throw new Error("Invalid upload path");
  }
  const configError = uploadStorageConfigurationError();
  if (configError && process.env.NODE_ENV === "production") {
    throw new Error(configError);
  }
  const key = `uploads/${opts.schoolId}/${relative}`;
  await getUploadStorage().put(key, opts.body, opts.contentType || "application/octet-stream");
  return `/uploads/${opts.schoolId}/${relative}`;
}

export async function readUploadByPathname(pathname: string): Promise<Buffer | null> {
  const key = objectKeyFromUploadPathname(pathname);
  if (!key) return null;
  try {
    return await getUploadStorage().get(key);
  } catch {
    // Fall back to legacy local public path when storage is S3 but file was never migrated.
    if (uploadStorageProviderName() === "s3") {
      try {
        const local = new LocalUploadStorage();
        return await local.get(key);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function listSchoolUploadSnapshotFiles(
  schoolId: string,
  maxBytes = 25 * 1024 * 1024
): Promise<{ relativePath: string; contentBase64: string }[]> {
  const storage = getUploadStorage();
  const prefix = `uploads/${schoolId}/`;
  const objects = await storage.list(prefix);
  const files: { relativePath: string; contentBase64: string }[] = [];
  for (const obj of objects) {
    if (obj.size > maxBytes) continue;
    try {
      const body = await storage.get(obj.key);
      files.push({
        relativePath: obj.key.replace(/\\/g, "/"),
        contentBase64: body.toString("base64"),
      });
    } catch {
      // skip unreadable objects
    }
  }
  return files;
}

export async function restoreUploadSnapshotFile(relativePath: string, contentBase64: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/") || normalized.includes("..") || normalized.includes("\0")) {
    return false;
  }
  const body = Buffer.from(contentBase64, "base64");
  await getUploadStorage().put(normalized, body);
  return true;
}
