import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { accrueSchoolLeaveEntitlements } from "@/lib/leave-entitlement";
import { sanitizeSchedulerError, scheduledJob } from "@/lib/scheduler/catalog";
import { releaseJobLease, tryAcquireJobLease } from "@/lib/scheduler/lock";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const definition = scheduledJob("leave-accrual");
  const lease = await tryAcquireJobLease("leave-accrual", definition?.leaseMs);
  if (!lease) return NextResponse.json({ ok: true, skipped: "already_running" });

  try {
    const schoolId = request.nextUrl.searchParams.get("schoolId");
    const schoolIds = schoolId
      ? [schoolId]
      : (await prisma.school.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id);

    const summaries = [];
    for (const id of schoolIds) {
      summaries.push({ schoolId: id, ...(await accrueSchoolLeaveEntitlements({ schoolId: id })) });
    }

    await releaseJobLease(lease, { ok: true });
    return NextResponse.json({
      ok: true,
      asOf: new Date().toISOString(),
      summaries,
    });
  } catch (error) {
    await releaseJobLease(lease, { ok: false, error: sanitizeSchedulerError(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
