import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { countLicenseUsage } from "@/lib/licensing/usage";
import { ensureDefaultSchedules } from "@/lib/backup/schedule";
import {
  backupConfigurationError,
  backupStorageProviderName,
  isDurableBackupStorageConfigured,
} from "@/lib/backup/crypto";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:read") && !requirePermission(session, "license.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await ensureDefaultSchedules(schoolId);
  const [evaluation, usage, license, lastBackup, nextSchedule, lastImport] = await Promise.all([
    evaluateStoredLicense(schoolId),
    countLicenseUsage(schoolId),
    prisma.schoolLicense.findUnique({ where: { schoolId } }),
    prisma.backupJob.findFirst({
      where: { schoolId, status: { in: ["SUCCEEDED", "VERIFIED"] } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.backupSchedule.findFirst({
      where: { schoolId, enabled: true },
      orderBy: { nextRunAt: "asc" },
    }),
    prisma.importJob.findFirst({
      where: { schoolId, providerCode: "sa-sams" },
      orderBy: { createdAt: "desc" },
      include: { batches: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const backupConfigError = backupConfigurationError();
  const backupProvider = backupStorageProviderName();

  return NextResponse.json({
    licence: {
      status: evaluation.effectiveStatus,
      restricted: evaluation.restricted,
      expiry: license?.expiresAt ?? null,
      usage: {
        learners: { used: usage.activeLearners, max: license?.maxLearners ?? null },
        educators: { used: usage.educators, max: license?.maxEducators ?? null },
      },
      warnings: evaluation.warnings,
    },
    backups: {
      lastSuccessful: lastBackup?.completedAt ?? null,
      next: nextSchedule?.nextRunAt ?? null,
      health: lastBackup ? "healthy" : "missing",
      storageProvider: backupProvider,
      durableStorageConfigured: isDurableBackupStorageConfigured(),
      configurationError: backupConfigError,
    },
    uploads: {
      storage: "local-public-uploads",
      durable: false,
      note: "Learner/finance files are stored under public/uploads on the app filesystem. Mount a persistent volume or migrate to object storage before relying on Railway redeploys.",
    },
    integrations: {
      provider: "SA-SAMS",
      lastImport: lastImport?.importedAt ?? lastImport?.createdAt ?? null,
      status: lastImport?.status ?? "NONE",
      recordsImported: lastImport?.batches[0]
        ? lastImport.batches[0].createdCount + lastImport.batches[0].updatedCount
        : 0,
    },
  });
}
