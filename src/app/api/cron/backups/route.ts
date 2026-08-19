import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { flagOverdueBackups, runDueBackupSchedules } from "@/lib/backup/schedule";

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
