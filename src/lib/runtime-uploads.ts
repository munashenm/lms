import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ACADEMIC_KINDS = new Set(["report-cards", "certificates", "letters"]);
const MAX_SEGMENTS = 8;
const SEGMENT = /^[A-Za-z0-9._-]+$/;

function isInside(full: string, root: string): boolean {
  return full === root || full.startsWith(root + path.sep);
}

export function dataUploadsRoot(): string {
  return path.resolve(process.cwd(), "data", "uploads");
}

export function publicUploadsRoot(): string {
  return path.resolve(process.cwd(), "public", "uploads");
}

/** Path segments under /uploads/... that are safe to read or write. */
export function parseUploadSegments(parts: string[]): string[] | null {
  if (parts.length === 0 || parts.length > MAX_SEGMENTS) return null;
  if (ACADEMIC_KINDS.has(parts[0] ?? "")) return null;
  for (const part of parts) {
    if (!part || part === "." || part === ".." || !SEGMENT.test(part)) return null;
  }
  return parts;
}

export function parseUploadUrl(urlPath: string | null | undefined): string[] | null {
  if (!urlPath) return null;
  const trimmed = urlPath.split("?")[0].trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  const relative = trimmed.replace(/^\/uploads\//, "").replace(/^\/+/, "");
  if (!relative || relative.includes("\\")) return null;
  return parseUploadSegments(relative.split("/").filter(Boolean));
}

export function contentTypeForUpload(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".zip":
      return "application/zip";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function readRuntimeUpload(
  urlPath: string | null | undefined
): Promise<{ bytes: Buffer; contentType: string; filename: string } | null> {
  const segments = parseUploadUrl(urlPath);
  if (!segments) return null;

  const dataRoot = dataUploadsRoot();
  const publicRoot = publicUploadsRoot();
  const candidates = [
    path.resolve(dataRoot, ...segments),
    path.resolve(publicRoot, ...segments),
  ];

  for (const full of candidates) {
    if (!isInside(full, dataRoot) && !isInside(full, publicRoot)) continue;
    try {
      const bytes = await readFile(full);
      return {
        bytes,
        contentType: contentTypeForUpload(segments[segments.length - 1] ?? ""),
        filename: segments[segments.length - 1] ?? "file",
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function saveRuntimeUpload(opts: {
  schoolId: string;
  folder?: string;
  filename: string;
  bytes: Buffer | Uint8Array;
}): Promise<string> {
  const folderParts = (opts.folder ?? "").split("/").filter(Boolean);
  const segments = parseUploadSegments([opts.schoolId, ...folderParts, opts.filename]);
  if (!segments) throw new Error("Invalid upload path");

  const absDir = path.join(dataUploadsRoot(), ...segments.slice(0, -1));
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(dataUploadsRoot(), ...segments), Buffer.from(opts.bytes));
  return `/uploads/${segments.join("/")}`;
}
