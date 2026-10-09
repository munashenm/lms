import { prisma } from "@/lib/db";
import { canonicalAppUrlWarning } from "@/lib/app-url";
import { maybeHeartbeat } from "@/lib/licensing/service";

export interface LicenseHeartbeatResult {
  activeLicences: number;
  due: number;
  checked: number;
  succeeded: number;
  failed: number;
  skippedNotDue: number;
  results: {
    schoolId: string;
    status: string;
    restricted: boolean;
    error: string | null;
    daysOffline: number | null;
    lastVerifiedAt: Date | null;
    nextVerificationAt: Date | null;
  }[];
}

/** Verifies only licences whose next check is due. Safe to call on startup. */
export async function runDueLicenseHeartbeats(schoolId?: string | null): Promise<LicenseHeartbeatResult> {
  const now = new Date();
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
  const results: LicenseHeartbeatResult["results"] = [];
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

  const summary = {
    activeLicences,
    due: due.length,
    checked: results.length,
    succeeded,
    failed,
    skippedNotDue: Math.max(0, activeLicences - due.length),
  };
  console.info("[license-heartbeat]", JSON.stringify(summary));
  return { ...summary, results };
}
