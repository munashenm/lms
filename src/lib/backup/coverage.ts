/** Automatic daily archives follow the stored licence status. Anything already saved is left alone. */
export function dailyBackupEnabledForLicenseStatus(status: string | null | undefined): boolean {
  return String(status ?? "").toUpperCase() === "ACTIVE";
}

export function backupCoverageNote(params: {
  licenseStatus: string | null | undefined;
  dailyEnabled: boolean;
  retainCount: number;
}): string {
  const paid = dailyBackupEnabledForLicenseStatus(params.licenseStatus);
  const keep = Math.max(0, params.retainCount);
  if (paid && params.dailyEnabled) {
    return `This paid licence keeps automatic daily backups. The latest ${keep} daily archives are retained. History and restore stay under Backup settings.`;
  }
  if (paid) {
    return "Daily backups are turned off for this paid licence. The saved schedule was not changed. History and restore stay available, and an administrator can turn daily backups on here.";
  }
  if (params.dailyEnabled) {
    return "Automatic daily backups are on. That saved schedule was not changed. A free trial does not turn them on by itself.";
  }
  return "This free trial does not run automatic daily backups, so a new archive is not stored every day. Manual backup, history, and restore stay available. Daily backups turn on when the school becomes a paying customer, unless an administrator has already saved a schedule.";
}

export function paidBackupCoverageMessage(params: { enabledNow: boolean; retainCount: number }): {
  title: string;
  message: string;
} {
  const keep = Math.max(0, params.retainCount);
  if (params.enabledNow) {
    return {
      title: "Daily backups are on",
      message: `This school is now on a paid licence. Automatic daily backups are on, keeping the latest ${keep} daily archives. Weekly and monthly schedules were not changed. History and restore are under Backup settings.`,
    };
  }
  return {
    title: "Daily backups unchanged",
    message: `This school is now on a paid licence. Daily backups were already on, so the saved schedule was left unchanged and still keeps the latest ${keep} daily archives.`,
  };
}
