import { BackupJobStatus, BackupType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifySchoolRoles } from "@/lib/notifications";
import { BACKUP_COMPATIBILITY_VERSION, BACKUP_EXTENSION, BACKUP_FORMAT_VERSION } from "./types";
import { getBackupEncryptionKey } from "./crypto";
import { packBackup, unpackBackup, verifyBackupIntegrity } from "./package";
import { APP_VERSION, SCHEMA_VERSION, buildSchoolSnapshot, snapshotCounts } from "./snapshot";
import { getBackupStorage } from "./storage";
import { checkBackupCompatibility } from "./compatibility";

async function notifyBackup(schoolId: string, title: string, message: string, type: "SUCCESS" | "WARNING" | "INFO") {
  await notifySchoolRoles({
    schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL],
    title,
    message,
    type,
    link: "/admin/settings/backup",
  });
}

export async function runBackupJob(opts: {
  schoolId: string;
  type: BackupType;
  createdById?: string | null;
}): Promise<{ jobId: string; status: BackupJobStatus; filename: string }> {
  const school = await prisma.school.findUnique({ where: { id: opts.schoolId } });
  if (!school) throw new Error("School not found");

  const job = await prisma.backupJob.create({
    data: {
      schoolId: opts.schoolId,
      type: opts.type,
      status: BackupJobStatus.RUNNING,
      createdById: opts.createdById ?? null,
      applicationVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      storageProvider: getBackupStorage().name,
      startedAt: new Date(),
    },
  });

  try {
    const snapshot = await buildSchoolSnapshot(opts.schoolId);
    const counts = snapshotCounts(snapshot);
    const plaintext = Buffer.from(JSON.stringify(snapshot), "utf8");
    const filename = `${school.slug}-${new Date().toISOString().replace(/[:.]/g, "-")}${BACKUP_EXTENSION}`;
    const pkg = packBackup(plaintext, getBackupEncryptionKey(), {
      backupVersion: BACKUP_FORMAT_VERSION,
      compatibilityVersion: BACKUP_COMPATIBILITY_VERSION,
      applicationVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      institutionId: school.id,
      institutionName: school.name,
      createdAt: new Date().toISOString(),
      learnerCount: counts.learnerCount,
      userCount: counts.userCount,
      fileCount: counts.fileCount,
      type: opts.type,
    });
    const integrity = verifyBackupIntegrity(pkg);
    if (!integrity.ok) throw new Error(integrity.error ?? "Integrity check failed");

    const storage = getBackupStorage();
    const key = `${opts.schoolId}/${job.id}/${filename}`;
    await storage.put(key, pkg, "application/octet-stream");

    await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: BackupJobStatus.SUCCEEDED,
        sizeBytes: BigInt(pkg.length),
        checksum: integrity.manifest?.checksum,
        storageKey: key,
        filename,
        learnerCount: counts.learnerCount,
        userCount: counts.userCount,
        fileCount: counts.fileCount,
        completedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    await logAudit({
      schoolId: opts.schoolId,
      userId: opts.createdById,
      action: "BACKUP_CREATED",
      entity: "BackupJob",
      entityId: job.id,
      metadata: { type: opts.type, size: pkg.length, files: counts.fileCount },
    });

    await notifyBackup(
      opts.schoolId,
      "Backup succeeded",
      `A ${opts.type.replaceAll("_", " ").toLowerCase()} backup completed successfully.`,
      "SUCCESS"
    );

    return { jobId: job.id, status: BackupJobStatus.SUCCEEDED, filename };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: BackupJobStatus.FAILED,
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    await logAudit({
      schoolId: opts.schoolId,
      userId: opts.createdById,
      action: "BACKUP_CREATED",
      entity: "BackupJob",
      entityId: job.id,
      metadata: { result: "FAILED" },
    });
    await notifyBackup(opts.schoolId, "Backup failed", "A backup job failed. Check Backup & Restore for details.", "WARNING");
    throw error;
  }
}

export async function readBackupPackage(schoolId: string, jobId: string): Promise<Buffer> {
  const job = await prisma.backupJob.findFirst({
    where: { id: jobId, schoolId, status: { not: BackupJobStatus.DELETED } },
  });
  if (!job?.storageKey) throw new Error("Backup not found");
  return getBackupStorage().get(job.storageKey);
}

export async function verifyStoredBackup(schoolId: string, jobId: string) {
  const pkg = await readBackupPackage(schoolId, jobId);
  const integrity = verifyBackupIntegrity(pkg);
  if (integrity.ok) {
    await prisma.backupJob.update({
      where: { id: jobId },
      data: { status: BackupJobStatus.VERIFIED, verifiedAt: new Date() },
    });
  }
  return integrity;
}

export async function deleteBackupJob(schoolId: string, jobId: string, userId?: string) {
  const job = await prisma.backupJob.findFirst({
    where: { id: jobId, schoolId },
  });
  if (!job) throw new Error("Backup not found");
  if (job.storageKey) {
    try {
      await getBackupStorage().delete(job.storageKey);
    } catch {
      // still mark deleted
    }
  }
  await prisma.backupJob.update({
    where: { id: jobId },
    data: { status: BackupJobStatus.DELETED, storageKey: null },
  });
  await logAudit({
    schoolId,
    userId,
    action: "BACKUP_DELETED",
    entity: "BackupJob",
    entityId: jobId,
  });
}

export { unpackBackup, checkBackupCompatibility };
