import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { countLicenseUsage } from "@/lib/licensing/usage";
import { ensureDefaultSchedules } from "@/lib/backup/schedule";
import { SystemHealthCards } from "@/components/enterprise/system-health-cards";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function SystemHealthPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "settings:read")) {
    redirect("/admin/dashboard");
  }
  const { schoolId: requested } = await searchParams;
  const schoolId = await resolveLicenseSchoolId(session, requested);
  if (!schoolId || !canAccessSchool(session, schoolId)) {
    redirect("/admin/dashboard");
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

  const health = {
    licence: {
      status: evaluation.effectiveStatus,
      restricted: evaluation.restricted,
      expiry: license?.expiresAt?.toISOString() ?? null,
      usage: {
        learners: { used: usage.activeLearners, max: license?.maxLearners ?? null },
        educators: { used: usage.educators, max: license?.maxEducators ?? null },
      },
      warnings: evaluation.warnings,
    },
    backups: {
      lastSuccessful: lastBackup?.completedAt?.toISOString() ?? null,
      next: nextSchedule?.nextRunAt?.toISOString() ?? null,
      health: lastBackup ? "healthy" : "missing",
    },
    integrations: {
      provider: "SA-SAMS",
      lastImport: (lastImport?.importedAt ?? lastImport?.createdAt)?.toISOString() ?? null,
      status: lastImport?.status ?? "NONE",
      recordsImported: lastImport?.batches[0]
        ? lastImport.batches[0].createdCount + lastImport.batches[0].updatedCount
        : 0,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-muted text-sm mt-1">Licence, backups and SA-SAMS integration at a glance.</p>
      </div>
      <SystemHealthCards health={health} schoolId={requested} />
    </div>
  );
}
