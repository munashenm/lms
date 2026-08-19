import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { cleanupExpiredImportFiles } from "@/lib/integrations/sasams/security";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const removed = await cleanupExpiredImportFiles(new Date());
  return NextResponse.json({ ok: true, removed });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
