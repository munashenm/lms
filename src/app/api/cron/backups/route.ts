import { NextRequest, NextResponse } from "next/server";
import { flagOverdueBackups, runDueBackupSchedules } from "@/lib/backup/schedule";

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
  const results = await runDueBackupSchedules();
  await flagOverdueBackups();
  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
