import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createS3StorageFromEnv } from "@/lib/backup/storage/s3";
import type { BackupStorageProvider } from "@/lib/backup/storage/types";

export type AcademicPdfKind = "report-cards" | "certificates" | "letters";

export function pdfFileResponse(bytes: Buffer | Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function isInside(full: string, root: string): boolean {
  return full === root || full.startsWith(root + path.sep);
}

export function academicPdfFilename(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) return null;
  if (!trimmed.toLowerCase().endsWith(".pdf")) return null;
  if (path.basename(trimmed) !== trimmed) return null;
  return trimmed;
}

export function academicObjectKey(kind: AcademicPdfKind, filename: string): string | null {
  const safe = academicPdfFilename(filename);
  if (!safe) return null;
  return `academic-pdfs/${kind}/${safe}`;
}

export function parseAcademicPdfUrl(relativeUrl: string | null | undefined): {
  kind: AcademicPdfKind;
  filename: string;
} | null {
  if (!relativeUrl) return null;
  const trimmed = relativeUrl.split("?")[0];
  const match = trimmed.match(/^\/uploads\/(report-cards|certificates|letters)\/([^/]+)$/);
  if (!match) return null;
  const filename = academicPdfFilename(match[2]);
  if (!filename) return null;
  return { kind: match[1] as AcademicPdfKind, filename };
}

function academicObjectStorage(): BackupStorageProvider | null {
  try {
    if ((process.env.BACKUP_STORAGE_PROVIDER || "").toLowerCase() !== "s3") return null;
    return createS3StorageFromEnv();
  } catch {
    return null;
  }
}

export async function readPublicPdf(relativeUrl: string | null | undefined) {
  if (!relativeUrl) return null;
  const trimmed = relativeUrl.split("?")[0];
  if (!trimmed.startsWith("/uploads/")) return null;
  const relative = trimmed.replace(/^\/+/, "");
  if (!relative.startsWith("uploads/") || relative.includes("..") || path.isAbsolute(relative)) {
    return null;
  }

  const dataRoot = path.resolve(process.cwd(), "data", "uploads");
  const publicRoot = path.resolve(process.cwd(), "public", "uploads");
  const candidates = [
    path.resolve(process.cwd(), "data", relative),
    path.resolve(process.cwd(), "public", relative),
  ];

  for (const full of candidates) {
    if (!isInside(full, dataRoot) && !isInside(full, publicRoot)) continue;
    try {
      return await readFile(full);
    } catch {
      continue;
    }
  }
  return null;
}

export async function writeAcademicPdf(
  kind: AcademicPdfKind,
  filename: string,
  bytes: Buffer | Uint8Array
): Promise<string> {
  const safe = academicPdfFilename(filename);
  if (!safe) throw new Error("Invalid academic PDF filename");
  const dir = path.join(process.cwd(), "data", "uploads", kind);
  await mkdir(dir, { recursive: true });
  const body = Buffer.from(bytes);
  await writeFile(path.join(dir, safe), body);

  const objectKey = academicObjectKey(kind, safe);
  const storage = academicObjectStorage();
  if (storage && objectKey) {
    try {
      await storage.put(objectKey, body, "application/pdf");
    } catch (err) {
      console.error("[academic-pdf] object storage put failed", err);
    }
  }

  return `/uploads/${kind}/${safe}`;
}

export async function readAcademicPdf(relativeUrl: string | null | undefined) {
  const local = await readPublicPdf(relativeUrl);
  if (local) return local;

  const parsed = parseAcademicPdfUrl(relativeUrl);
  const storage = academicObjectStorage();
  if (!parsed || !storage) return null;
  const objectKey = academicObjectKey(parsed.kind, parsed.filename);
  if (!objectKey) return null;
  try {
    const remote = await storage.get(objectKey);
    try {
      await writeAcademicPdf(parsed.kind, parsed.filename, remote);
    } catch {
      // Serving the bytes matters more than recaching locally.
    }
    return remote;
  } catch {
    return null;
  }
}
