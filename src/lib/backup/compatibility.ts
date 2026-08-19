import { BACKUP_COMPATIBILITY_VERSION, type BackupManifest, type BackupSnapshot } from "./types";

export function checkBackupCompatibility(manifest: BackupManifest): {
  ok: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (manifest.compatibilityVersion > BACKUP_COMPATIBILITY_VERSION) {
    errors.push(
      `This backup requires compatibility version ${manifest.compatibilityVersion}, but this LMS supports ${BACKUP_COMPATIBILITY_VERSION}.`
    );
  }
  if (manifest.backupVersion !== 1) {
    errors.push(`Unsupported backup format version ${manifest.backupVersion}.`);
  }
  if (manifest.applicationVersion && manifest.applicationVersion !== (process.env.npm_package_version || "0.1.0")) {
    warnings.push(
      `Backup was created with application version ${manifest.applicationVersion}. Restoring onto a different version may omit newer fields.`
    );
  }
  return { ok: errors.length === 0, warnings, errors };
}

export function describeSnapshot(snapshot: BackupSnapshot) {
  return {
    institutionId: snapshot.school.id,
    institutionName: snapshot.school.name,
    learners: snapshot.students.length,
    users: snapshot.users.length,
    educators: snapshot.teachers.length,
    guardians: snapshot.guardians.length,
    classes: snapshot.classes.length,
    subjects: snapshot.subjects.length,
    invoices: snapshot.invoices.length,
    attendance: snapshot.attendanceRecords.length,
    assessments: snapshot.assessments.length,
    files: snapshot.files.length,
  };
}
