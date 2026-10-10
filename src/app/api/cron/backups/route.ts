import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { flagOverdueBackups, runDueBackupSchedules } from "@/lib/backup/schedule";
import { sanitizeSchedulerError, scheduledJob } from "@/lib/scheduler/catalog";
import { releaseJobLease, tryAcquireJobLease } from "@/lib/scheduler/lock";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const definition = scheduledJob("backups");
  const lease = await tryAcquireJobLease("backups", definition?.leaseMs);
  if (!lease) {
    return NextResponse.json({ ok: true, skipped: "already_running" });
  }
  try {
    const results = await runDueBackupSchedules();
    await flagOverdueBackups();
    await releaseJobLease(lease, { ok: true });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    await releaseJobLease(lease, { ok: false, error: sanitizeSchedulerError(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
