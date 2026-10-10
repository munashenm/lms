import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { generateDueRecurringExpenses } from "@/lib/recurring-expenses";
import { sanitizeSchedulerError, scheduledJob } from "@/lib/scheduler/catalog";
import { releaseJobLease, tryAcquireJobLease } from "@/lib/scheduler/lock";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const definition = scheduledJob("recurring-expenses");
  const lease = await tryAcquireJobLease("recurring-expenses", definition?.leaseMs);
  if (!lease) return NextResponse.json({ ok: true, skipped: "already_running" });

  try {
    const schoolId = request.nextUrl.searchParams.get("schoolId") ?? undefined;
    const summary = await generateDueRecurringExpenses({ schoolId });
    await releaseJobLease(lease, { ok: true });
    return NextResponse.json({
      ok: true,
      asOf: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    await releaseJobLease(lease, { ok: false, error: sanitizeSchedulerError(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
