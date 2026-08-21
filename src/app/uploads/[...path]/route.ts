import { NextRequest, NextResponse } from "next/server";
import { parseUploadSegments, readRuntimeUpload } from "@/lib/runtime-uploads";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export const dynamic = "force-dynamic";

/** Serve logos and other runtime uploads. Next.js does not serve files written to /public after build. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { path: parts } = await params;
  const segments = parseUploadSegments(parts ?? []);
  if (!segments) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const file = await readRuntimeUpload(`/uploads/${segments.join("/")}`);
  if (!file) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="${file.filename}"`,
    },
  });
}
