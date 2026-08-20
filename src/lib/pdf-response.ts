import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
  kind: "report-cards" | "certificates" | "letters",
  filename: string,
  bytes: Buffer | Uint8Array
): Promise<string> {
  const dir = path.join(process.cwd(), "data", "uploads", kind);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${kind}/${filename}`;
}
