import { LocalBackupStorage } from "./local";
import { createS3StorageFromEnv } from "./s3";
import type { BackupStorageProvider } from "./types";

export function getBackupStorage(): BackupStorageProvider {
  const provider = (process.env.BACKUP_STORAGE_PROVIDER || "local").toLowerCase();
  if (provider === "s3") return createS3StorageFromEnv();
  return new LocalBackupStorage();
}

export type { BackupStorageProvider } from "./types";
