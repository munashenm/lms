import Link from "next/link";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { needsSuperAdminSchoolPicker, resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { countLicenseUsage } from "@/lib/licensing/usage";
import { ensureDefaultSchedules } from "@/lib/backup/schedule";
import { SystemHealthCards } from "@/components/enterprise/system-health-cards";
import { ScheduledJobsPanel } from "@/components/enterprise/scheduled-jobs-panel";
import { listScheduledJobStatus } from "@/lib/scheduler/status";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function SystemHealthPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "settings:read")) {
    redirect("/admin/dashboard");
  }
  const { schoolId: requested } = await searchParams;
  let scheduledJobs: Awaited<ReturnType<typeof listScheduledJobStatus>> | null = null;
  if (session.role === UserRole.SUPER_ADMIN) {
    try {
      scheduledJobs = await listScheduledJobStatus();
    } catch {
      scheduledJobs = null;
    }
  }

  // Super Admin has no home school. Prefer an in-page picker (or auto-select the only
  // school) instead of redirect()/dashboard bounce — client navigations surface those
  // as a hard failure ("crashes") in the App Router.
  let resolvedRequested = requested;
  if (needsSuperAdminSchoolPicker(session, resolvedRequested)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    if (schools.length === 1) {
      resolvedRequested = schools[0].id;
    } else {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-muted text-sm mt-1">
              Select a school to view licence, backup and SA-SAMS health.
            </p>
          </div>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {schools.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">No schools found.</p>
              ) : (
                schools.map((school) => (
                  <div
                    key={school.id}
                    className="px-4 py-3 flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-xs text-muted">{school.slug}</p>
                    </div>
                    <Link
                      href={`/admin/system-health?schoolId=${school.id}`}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      View health
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {scheduledJobs ? <ScheduledJobsPanel jobs={scheduledJobs} /> : null}
        </div>
      );
    }
  }

  const schoolId = await resolveLicenseSchoolId(session, resolvedRequested);
  if (!schoolId || !canAccessSchool(session, schoolId)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-muted text-sm mt-1">
            Choose a school from Institutions, then open System Health again.
          </p>
        </div>
        <Link href="/admin/institutions" className="text-primary text-sm hover:underline">
          Open institutions
        </Link>
      </div>
    );
  }

  const isSuperAdminView = session.role === UserRole.SUPER_ADMIN && !session.schoolId;
  const schoolName =
    isSuperAdminView && schoolId
      ? (
          await prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
          })
        )?.name
      : null;

  try {
    await ensureDefaultSchedules(schoolId);
  } catch {
    // Schedules are helpful but must not take down the health page.
  }

  let health: {
    licence: {
      status: string;
      restricted: boolean;
      expiry: string | null;
      usage: {
        learners: { used: number; max: number | null };
        educators: { used: number; max: number | null };
      };
      warnings: string[];
    };
    backups: { lastSuccessful: string | null; next: string | null; health: string };
    integrations: {
      provider: string;
      lastImport: string | null;
      status: string;
      recordsImported: number;
    };
  };

  try {
    const [evaluation, usage, license, lastBackup, nextSchedule, lastImport] =
      await Promise.all([
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

    health = {
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
  } catch {
    health = {
      licence: {
        status: "UNKNOWN",
        restricted: false,
        expiry: null,
        usage: {
          learners: { used: 0, max: null },
          educators: { used: 0, max: null },
        },
        warnings: ["Unable to load full licence status right now."],
      },
      backups: { lastSuccessful: null, next: null, health: "unknown" },
      integrations: {
        provider: "SA-SAMS",
        lastImport: null,
        status: "UNKNOWN",
        recordsImported: 0,
      },
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-muted text-sm mt-1">
          Licence, backups and SA-SAMS integration at a glance
          {schoolName ? ` — ${schoolName}` : ""}.
        </p>
      </div>
      <SystemHealthCards health={health} schoolId={resolvedRequested ?? schoolId} />
      {scheduledJobs ? <ScheduledJobsPanel jobs={scheduledJobs} /> : null}
    </div>
  );
}
