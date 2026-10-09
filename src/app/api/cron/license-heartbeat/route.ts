import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { maybeHeartbeat } from "@/lib/licensing/service";
import { canonicalAppUrlWarning } from "@/lib/app-url";
import { prisma } from "@/lib/db";

/**
 * Verifies licences whose nextVerificationAt is due.
 * Schedule this daily. A licensed write is not a substitute for the schedule.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  const dueWhere = {
    ...(schoolId ? { schoolId } : {}),
    school: { isActive: true },
    OR: [{ nextVerificationAt: null }, { nextVerificationAt: { lte: now } }],
  };
  const [due, activeLicences] = await Promise.all([
    prisma.schoolLicense.findMany({
      where: dueWhere,
      select: { schoolId: true },
    }),
    prisma.schoolLicense.count({
      where: schoolId ? { schoolId, school: { isActive: true } } : { school: { isActive: true } },
    }),
  ]);

  const urlWarning = canonicalAppUrlWarning();
  if (urlWarning) console.warn("[license-heartbeat]", JSON.stringify({ warning: "app-url", message: urlWarning }));

  let succeeded = 0;
  let failed = 0;
  const results = [];
  for (const license of due) {
    const evaluation = await maybeHeartbeat(license.schoolId);
    const stored = await prisma.schoolLicense.findUnique({
      where: { schoolId: license.schoolId },
      select: { lastCheckError: true, lastVerifiedAt: true, nextVerificationAt: true },
    });
    const error = stored?.lastCheckError ?? null;
    if (error) failed += 1;
    else succeeded += 1;
    results.push({
      schoolId: license.schoolId,
      status: evaluation.effectiveStatus,
      restricted: evaluation.restricted,
      error,
      daysOffline: evaluation.daysOffline,
      lastVerifiedAt: stored?.lastVerifiedAt ?? null,
      nextVerificationAt: stored?.nextVerificationAt ?? null,
    });
    console.info(
      "[license-heartbeat]",
      JSON.stringify({
        schoolId: license.schoolId,
        status: evaluation.effectiveStatus,
        restricted: evaluation.restricted,
        error,
        daysOffline: evaluation.daysOffline,
      })
    );
  }

  console.info(
    "[license-heartbeat]",
    JSON.stringify({
      activeLicences,
      due: due.length,
      checked: results.length,
      succeeded,
      failed,
      skippedNotDue: Math.max(0, activeLicences - due.length),
    })
  );

  return NextResponse.json({
    ok: true,
    activeLicences,
    due: due.length,
    checked: results.length,
    succeeded,
    failed,
    skippedNotDue: Math.max(0, activeLicences - due.length),
    results,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
