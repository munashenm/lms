import { BackupScheduleFrequency, BackupType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runBackupJob } from "./engine";
import { notifySchoolRoles } from "@/lib/notifications";
import { sanitizeSchedulerError } from "@/lib/scheduler/catalog";

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

/**
 * Creates any missing daily, weekly, or monthly schedule.
 * An existing row is left unchanged, including when it is disabled or has a custom retain count.
 */
export async function ensureDefaultSchedules(schoolId: string): Promise<number> {
  let created = 0;
  for (const frequency of Object.values(BackupScheduleFrequency)) {
    const existing = await prisma.backupSchedule.findUnique({
      where: { schoolId_frequency: { schoolId, frequency } },
      select: { id: true },
    });
    if (existing) continue;
    try {
      await prisma.backupSchedule.create({
        data: {
          schoolId,
          frequency,
          retainCount: DEFAULTS[frequency],
          enabled: frequency === BackupScheduleFrequency.DAILY,
          nextRunAt: nextRunAt(frequency),
        },
      });
      created += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return created;
}

/** Idempotent backfill. Does not update or delete schedules or backup files. */
export async function provisionMissingBackupSchedules(schoolId?: string) {
  const schools = await prisma.school.findMany({
    where: schoolId ? { id: schoolId } : undefined,
    select: { id: true },
  });
  let created = 0;
  for (const school of schools) {
    created += await ensureDefaultSchedules(school.id);
  }
  return { schools: schools.length, created };
}

export function scheduleFrequencyFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { scheduleFrequency?: unknown }).scheduleFrequency;
  return typeof value === "string" && value ? value : null;
}

/** Newest-first jobs. Untagged historical backups are never selected for deletion. */
export function backupIdsToPrune(
  jobs: Array<{ id: string; metadata: unknown }>,
  frequency: string,
  retainCount: number
): string[] {
  const keep = Math.max(0, retainCount);
  return jobs
    .filter((job) => scheduleFrequencyFromMetadata(job.metadata) === frequency)
    .slice(keep)
    .map((job) => job.id);
}

export async function runDueBackupSchedules(now = new Date()) {
  await provisionMissingBackupSchedules();
  const due = await prisma.backupSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
  });
  const results = [];
  for (const schedule of due) {
    const claimed = await prisma.backupSchedule.updateMany({
      where: { id: schedule.id, enabled: true, nextRunAt: { lte: now } },
      data: { nextRunAt: nextRunAt(schedule.frequency, now) },
    });
    if (claimed.count !== 1) continue;
    try {
      await runBackupJob({
        schoolId: schedule.schoolId,
        type: BackupType.CLOUD_SCHEDULED,
        scheduleFrequency: schedule.frequency,
      });
      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now },
      });
      await pruneBackups(schedule.schoolId, schedule.frequency, schedule.retainCount);
      results.push({ schoolId: schedule.schoolId, frequency: schedule.frequency, ok: true });
    } catch (error) {
      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: now },
      });
      const detail = sanitizeSchedulerError(error);
      await notifyBackupIssue({
        schoolId: schedule.schoolId,
        title: "Backup failed",
        message: `The ${schedule.frequency.toLowerCase()} backup did not finish. ${detail}`,
        now,
      });
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
    select: { id: true, metadata: true },
  });
  const extras = backupIdsToPrune(jobs, frequency, retainCount);
  const { deleteBackupJob } = await import("./engine");
  for (const jobId of extras) {
    await deleteBackupJob(schoolId, jobId);
  }
}

async function notifyBackupIssue(params: {
  schoolId: string;
  title: string;
  message: string;
  now: Date;
}) {
  const recent = await prisma.notification.findFirst({
    where: {
      schoolId: params.schoolId,
      title: params.title,
      createdAt: { gte: new Date(params.now.getTime() - 20 * 60 * 60 * 1000) },
    },
  });
  if (recent) return;
  await notifySchoolRoles({
    schoolId: params.schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN],
    title: params.title,
    message: params.message,
    type: "WARNING",
    link: "/admin/settings/backup",
  });
}

export async function flagOverdueBackups(now = new Date()) {
  const schedules = await prisma.backupSchedule.findMany({
    where: { enabled: true },
  });
  for (const schedule of schedules) {
    if (!schedule.nextRunAt) continue;
    const overdueMs = now.getTime() - schedule.nextRunAt.getTime();
    if (overdueMs > 36 * 60 * 60 * 1000) {
      await notifyBackupIssue({
        schoolId: schedule.schoolId,
        title: "Backup overdue",
        message: "A scheduled backup has not completed within the expected period.",
        now,
      });
    }
  }
}
