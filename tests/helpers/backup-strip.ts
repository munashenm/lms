import { SECRET_BACKUP_FIELDS } from "@/lib/backup/types";

/** Mirror of snapshot stripSecrets for unit tests (no DB). */
export function stripSecretsForTest<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const field of SECRET_BACKUP_FIELDS) {
    if (field in copy) {
      (copy as Record<string, unknown>)[field] = null;
    }
  }
  return copy;
}
