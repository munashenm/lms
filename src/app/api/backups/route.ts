import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { BackupScheduleFrequency, BackupType } from "@prisma/client";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { ensureDefaultSchedules, nextRunAt } from "@/lib/backup/schedule";
import { runBackupJob } from "@/lib/backup/engine";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "backup.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  await ensureDefaultSchedules(schoolId);

  const [jobs, schedules, restores] = await Promise.all([
    prisma.backupJob.findMany({
      where: { schoolId, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.backupSchedule.findMany({ where: { schoolId } }),
    prisma.restoreJob.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const successful = jobs.filter((j) => j.status === "SUCCEEDED" || j.status === "VERIFIED");
  const lastSuccessful = successful[0] ?? null;
  const nextScheduled = schedules
    .filter((s) => s.enabled && s.nextRunAt)
    .sort((a, b) => (a.nextRunAt!.getTime() ?? 0) - (b.nextRunAt!.getTime() ?? 0))[0];
  const totalBytes = jobs.reduce((sum, j) => sum + Number(j.sizeBytes), 0);
  const oldest = successful.at(-1);
  const latest = successful[0];
  const overdue = Boolean(
    nextScheduled?.nextRunAt && Date.now() - nextScheduled.nextRunAt.getTime() > 36 * 60 * 60 * 1000
  );

  return NextResponse.json({
    health: {
      lastSuccessfulBackup: lastSuccessful?.completedAt ?? null,
      nextScheduledBackup: nextScheduled?.nextRunAt ?? null,
      cloudBackups: jobs.filter((j) => j.type !== "OFFLINE").length,
      offlineBackups: jobs.filter((j) => j.type === "OFFLINE").length,
      totalStorageBytes: totalBytes,
      oldestRestorePoint: oldest?.completedAt ?? null,
      latestRestorePoint: latest?.completedAt ?? null,
      status: overdue ? "overdue" : lastSuccessful ? "healthy" : "missing",
    },
    schedules,
    jobs: jobs.map((j) => ({
      ...j,
      sizeBytes: j.sizeBytes.toString(),
    })),
    restores,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "backup.create")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const body = (await request.json()) as { schoolId?: string; type?: "CLOUD_MANUAL" | "OFFLINE" };
  const schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const type = body.type === "OFFLINE" ? BackupType.OFFLINE : BackupType.CLOUD_MANUAL;
  try {
    const result = await runBackupJob({
      schoolId,
      type,
      createdById: session!.userId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Backup failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "backup.settings")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const body = (await request.json()) as {
    schoolId?: string;
    frequency: BackupScheduleFrequency;
    enabled?: boolean;
    retainCount?: number;
  };
  const schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  await ensureDefaultSchedules(schoolId);
  const updated = await prisma.backupSchedule.update({
    where: { schoolId_frequency: { schoolId, frequency: body.frequency } },
    data: {
      enabled: body.enabled,
      retainCount: body.retainCount,
      nextRunAt: body.enabled === false ? undefined : nextRunAt(body.frequency),
    },
  });
  return NextResponse.json({ schedule: updated });
}
