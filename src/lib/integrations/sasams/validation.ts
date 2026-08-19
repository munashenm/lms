import type { ImportEntityType, ImportIssue } from "./types";

const SA_ID = /^\d{13}$/;

export function validateMappedRecord(
  entityType: ImportEntityType,
  mapped: Record<string, string>
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const get = (k: string) => (mapped[k] ?? "").trim();

  if (entityType === "learner") {
    if (!get("firstName")) {
      issues.push({ severity: "ERROR", code: "MISSING_FIRST_NAME", message: "Missing learner name", field: "firstName" });
    }
    if (!get("lastName")) {
      issues.push({ severity: "ERROR", code: "MISSING_LAST_NAME", message: "Missing learner surname", field: "lastName" });
    }
    const dob = get("dateOfBirth");
    if (dob && Number.isNaN(Date.parse(dob))) {
      issues.push({ severity: "ERROR", code: "INVALID_DATE", message: "Invalid date of birth", field: "dateOfBirth" });
    }
    const grade = get("grade");
    if (grade && !/^(\d{1,2}|R|RR|Grade\s*\d{1,2})$/i.test(grade) && grade.length > 40) {
      issues.push({ severity: "ERROR", code: "INVALID_GRADE", message: "Invalid grade information", field: "grade" });
    }
    const id = get("saIdNumber").replace(/\s/g, "");
    if (id && !SA_ID.test(id)) {
      issues.push({ severity: "ERROR", code: "INVALID_ID", message: "Identity number is not a 13-digit SA ID", field: "saIdNumber" });
    }
    if (!get("studentNumber") && !id && !get("passportNumber")) {
      issues.push({
        severity: "WARNING",
        code: "WEAK_IDENTIFIER",
        message: "No admission number, ID, or passport — duplicate detection will rely on name and date of birth",
      });
    }
    if (!get("grade")) {
      issues.push({ severity: "WARNING", code: "MISSING_GRADE", message: "Grade is not set", field: "grade" });
    }
  }

  if (entityType === "educator") {
    if (!get("firstName") || !get("lastName")) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_EDUCATOR_NAME",
        message: "Educator first or last name is missing",
      });
    }
  }

  if (entityType === "guardian") {
    if (!get("firstName") && !get("lastName") && !get("phone") && !get("email")) {
      issues.push({
        severity: "WARNING",
        code: "MISSING_PARENT",
        message: "Parent/guardian details are incomplete",
      });
    }
  }

  if (entityType === "subject" && !get("name") && !get("code")) {
    issues.push({
      severity: "ERROR",
      code: "INVALID_SUBJECT",
      message: "Subject cannot be mapped without a name or code",
    });
  }

  if (Object.values(mapped).every((v) => !v)) {
    issues.push({
      severity: "ERROR",
      code: "UNMAPPABLE",
      message: "Record cannot be mapped — no target fields were populated",
    });
  }

  return issues;
}

export function classifyRecordStatus(issues: ImportIssue[]): "VALID" | "WARNING" | "ERROR" {
  if (issues.some((i) => i.severity === "ERROR")) return "ERROR";
  if (issues.some((i) => i.severity === "WARNING")) return "WARNING";
  return "VALID";
}

export function findDuplicateSourceRecords(
  records: { index: number; mapped: Record<string, string> }[]
): Map<number, number[]> {
  const groups = new Map<string, number[]>();
  for (const rec of records) {
    const keys = identityKeys(rec.mapped);
    for (const key of keys) {
      const list = groups.get(key) ?? [];
      list.push(rec.index);
      groups.set(key, list);
    }
  }
  const out = new Map<number, number[]>();
  for (const indexes of groups.values()) {
    const unique = [...new Set(indexes)];
    if (unique.length < 2) continue;
    for (const i of unique) {
      out.set(i, unique.filter((j) => j !== i));
    }
  }
  return out;
}

export function identityKeys(mapped: Record<string, string>): string[] {
  const keys: string[] = [];
  const id = (mapped.saIdNumber ?? "").replace(/\s/g, "");
  const passport = (mapped.passportNumber ?? "").trim().toUpperCase();
  const number = (mapped.studentNumber ?? "").trim().toUpperCase();
  const nameDob = [
    (mapped.firstName ?? "").trim().toLowerCase(),
    (mapped.lastName ?? "").trim().toLowerCase(),
    (mapped.dateOfBirth ?? "").slice(0, 10),
  ];
  if (id) keys.push(`id:${id}`);
  if (passport) keys.push(`passport:${passport}`);
  if (number) keys.push(`number:${number}`);
  if (nameDob[0] && nameDob[1] && nameDob[2]) keys.push(`namedob:${nameDob.join("|")}`);
  return keys;
}
