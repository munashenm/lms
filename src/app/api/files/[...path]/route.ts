import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/auth";
import { canAccessUploadPath } from "@/lib/upload-access";
import { isPublicUploadPath, parseUploadPath } from "@/lib/upload-path";
import { readUploadByPathname } from "@/lib/uploads/storage";

interface Params {
  params: Promise<{ path: string[] }>;
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const parts = (await params).path ?? [];
  if (!parts.length || parts.some((p) => p.includes("..") || p.includes("\\") || p.includes("\0"))) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const pathname = `/uploads/${parts.join("/")}`;
  const parsed = parseUploadPath(pathname);
  if (!parsed) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (!isPublicUploadPath(pathname)) {
    const session = await getSession();
    if (!session || !(await canAccessUploadPath(session, pathname))) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
  }

  const data = await readUploadByPathname(pathname);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(parts[parts.length - 1] ?? "file"),
      "Content-Length": String(data.length),
      "Cache-Control": isPublicUploadPath(pathname)
        ? "public, max-age=3600"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
