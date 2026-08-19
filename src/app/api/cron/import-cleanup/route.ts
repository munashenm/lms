import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredImportFiles } from "@/lib/integrations/sasams/security";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

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
