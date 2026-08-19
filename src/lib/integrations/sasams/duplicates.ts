import type { ImportIssue } from "./types";
import { identityKeys } from "./validation";

export type DuplicateDecision = "SKIP" | "UPDATE_EXISTING" | "CREATE_NEW" | "REVIEW_MANUALLY";

export function shouldSkipStagingRecord(record: {
  validationStatus: string;
  duplicateAction: string;
}): boolean {
  return (
    record.validationStatus === "ERROR" ||
    record.duplicateAction === "SKIP" ||
    record.duplicateAction === "REVIEW_MANUALLY"
  );
}

export interface ExistingLearner {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  saIdNumber: string | null;
  dateOfBirth: Date | null;
}

export interface DuplicateMatch {
  existingId: string | null;
  reason: string | null;
  suggested: DuplicateDecision;
  issues: ImportIssue[];
}

export function matchExistingLearner(
  mapped: Record<string, string>,
  existing: ExistingLearner[]
): DuplicateMatch {
  const incoming = identityKeys(mapped);
  for (const row of existing) {
    const keys = identityKeys({
      firstName: row.firstName,
      lastName: row.lastName,
      studentNumber: row.studentNumber,
      saIdNumber: row.saIdNumber ?? "",
      dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "",
    });
    const hit = incoming.find((k) => keys.includes(k));
    if (hit) {
      return {
        existingId: row.id,
        reason: hit.split(":")[0],
        suggested: "UPDATE_EXISTING",
        issues: [
          {
            severity: "WARNING",
            code: "DUPLICATE_LEARNER",
            message: "A matching learner already exists in this school. Choose Skip, Update, or Create New.",
          },
        ],
      };
    }
  }
  return { existingId: null, reason: null, suggested: "CREATE_NEW", issues: [] };
}

export function matchExistingEducator(
  mapped: Record<string, string>,
  existing: { id: string; firstName: string; lastName: string; employeeNumber: string; saIdNumber: string | null }[]
): DuplicateMatch {
  const id = (mapped.saIdNumber ?? "").replace(/\s/g, "");
  const emp = (mapped.employeeNumber ?? "").trim().toUpperCase();
  const name = `${(mapped.firstName ?? "").trim().toLowerCase()}|${(mapped.lastName ?? "").trim().toLowerCase()}`;
  for (const row of existing) {
    if (id && row.saIdNumber === id) {
      return {
        existingId: row.id,
        reason: "id",
        suggested: "UPDATE_EXISTING",
        issues: [{ severity: "WARNING", code: "DUPLICATE_EDUCATOR", message: "A matching educator already exists." }],
      };
    }
    if (emp && row.employeeNumber.toUpperCase() === emp) {
      return {
        existingId: row.id,
        reason: "employee",
        suggested: "UPDATE_EXISTING",
        issues: [{ severity: "WARNING", code: "DUPLICATE_EDUCATOR", message: "A matching educator already exists." }],
      };
    }
    if (`${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}` === name && name !== "|") {
      return {
        existingId: row.id,
        reason: "name",
        suggested: "REVIEW_MANUALLY",
        issues: [{ severity: "WARNING", code: "DUPLICATE_EDUCATOR", message: "An educator with the same name already exists." }],
      };
    }
  }
  return { existingId: null, reason: null, suggested: "CREATE_NEW", issues: [] };
}
