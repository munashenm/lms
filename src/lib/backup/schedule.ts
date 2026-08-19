import { BackupScheduleFrequency, BackupType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runBackupJob } from "./engine";
import { notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";

const DEFAULTS: Record<BackupScheduleFrequency, number> = {
  DAILY: 14,
  WEEKLY: 8,
  MONTHLY: 12,
};

export function nextRunAt(frequency: BackupScheduleFrequency, from = new Date()): Date {
  const next = new Date(from);
  if (frequency === BackupScheduleFrequency.DAILY) {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === BackupScheduleFrequency.WEEKLY) {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

export async function ensureDefaultSchedules(schoolId: string) {
  for (const frequency of Object.values(BackupScheduleFrequency)) {
    await prisma.backupSchedule.upsert({
      where: { schoolId_frequency: { schoolId, frequency } },
      update: {},
      create: {
        schoolId,
        frequency,
        retainCount: DEFAULTS[frequency],
        enabled: frequency === BackupScheduleFrequency.DAILY,
        nextRunAt: nextRunAt(frequency),
      },
    });
  }
}

export async function runDueBackupSchedules(now = new Date()) {
  const due = await prisma.backupSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
  });
  const results = [];
  for (const schedule of due) {
    try {
      await runBackupJob({
        schoolId: schedule.schoolId,
        type: BackupType.CLOUD_SCHEDULED,
      });
      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, nextRunAt: nextRunAt(schedule.frequency, now) },
      });
      await pruneBackups(schedule.schoolId, schedule.frequency, schedule.retainCount);
      results.push({ schoolId: schedule.schoolId, frequency: schedule.frequency, ok: true });
    } catch {
      results.push({ schoolId: schedule.schoolId, frequency: schedule.frequency, ok: false });
    }
  }
  return results;
}

export async function pruneBackups(
  schoolId: string,
  frequency: BackupScheduleFrequency,
  retainCount: number
) {
  const jobs = await prisma.backupJob.findMany({
    where: { schoolId, type: BackupType.CLOUD_SCHEDULED, status: { in: ["SUCCEEDED", "VERIFIED"] } },
    orderBy: { createdAt: "desc" },
  });
  const extras = jobs.slice(retainCount);
  const { deleteBackupJob } = await import("./engine");
  for (const job of extras) {
    await deleteBackupJob(schoolId, job.id);
  }
}

export async function flagOverdueBackups(now = new Date()) {
  const schedules = await prisma.backupSchedule.findMany({
    where: { enabled: true },
  });
  for (const schedule of schedules) {
    if (!schedule.nextRunAt) continue;
    const overdueMs = now.getTime() - schedule.nextRunAt.getTime();
    if (overdueMs > 36 * 60 * 60 * 1000) {
      await notifySchoolRoles({
        schoolId: schedule.schoolId,
        roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN],
        title: "Backup overdue",
        message: "A scheduled backup has not completed within the expected period.",
        type: "WARNING",
        link: "/admin/settings/backup",
      });
    }
  }
}
