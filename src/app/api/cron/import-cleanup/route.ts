import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { cleanupExpiredImportFiles } from "@/lib/integrations/sasams/security";
import { sanitizeSchedulerError, scheduledJob } from "@/lib/scheduler/catalog";
import { releaseJobLease, tryAcquireJobLease } from "@/lib/scheduler/lock";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const definition = scheduledJob("import-cleanup");
  const lease = await tryAcquireJobLease("import-cleanup", definition?.leaseMs);
  if (!lease) return NextResponse.json({ ok: true, skipped: "already_running" });
  try {
    const removed = await cleanupExpiredImportFiles(new Date());
    await releaseJobLease(lease, { ok: true });
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    await releaseJobLease(lease, { ok: false, error: sanitizeSchedulerError(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
