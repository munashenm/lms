import type { ImportEntityType } from "./types";
import { LMS_TARGET_FIELDS } from "./types";

const HEADER_ALIASES: Record<string, { entity: ImportEntityType; field: string; confidence: number }> = {
  learnername: { entity: "learner", field: "firstName", confidence: 80 },
  firstname: { entity: "learner", field: "firstName", confidence: 90 },
  name: { entity: "learner", field: "firstName", confidence: 55 },
  learnersurname: { entity: "learner", field: "lastName", confidence: 80 },
  surname: { entity: "learner", field: "lastName", confidence: 85 },
  lastname: { entity: "learner", field: "lastName", confidence: 90 },
  identitynumber: { entity: "learner", field: "saIdNumber", confidence: 90 },
  idnumber: { entity: "learner", field: "saIdNumber", confidence: 88 },
  saidnumber: { entity: "learner", field: "saIdNumber", confidence: 95 },
  passportnumber: { entity: "learner", field: "passportNumber", confidence: 90 },
  admissionnumber: { entity: "learner", field: "studentNumber", confidence: 90 },
  studentnumber: { entity: "learner", field: "studentNumber", confidence: 95 },
  learnerid: { entity: "learner", field: "studentNumber", confidence: 70 },
  dateofbirth: { entity: "learner", field: "dateOfBirth", confidence: 90 },
  dob: { entity: "learner", field: "dateOfBirth", confidence: 80 },
  gender: { entity: "learner", field: "gender", confidence: 90 },
  grade: { entity: "learner", field: "grade", confidence: 80 },
  class: { entity: "learner", field: "class", confidence: 75 },
  classname: { entity: "class", field: "name", confidence: 80 },
  guardian: { entity: "guardian", field: "firstName", confidence: 50 },
  parent: { entity: "guardian", field: "firstName", confidence: 50 },
  parentname: { entity: "guardian", field: "firstName", confidence: 80 },
  parentsurname: { entity: "guardian", field: "lastName", confidence: 80 },
  subject: { entity: "subject", field: "name", confidence: 80 },
  subjectname: { entity: "subject", field: "name", confidence: 90 },
  subjectcode: { entity: "subject", field: "code", confidence: 90 },
  educator: { entity: "educator", field: "firstName", confidence: 50 },
  teacher: { entity: "educator", field: "firstName", confidence: 50 },
  employeenumber: { entity: "educator", field: "employeeNumber", confidence: 90 },
  email: { entity: "learner", field: "email", confidence: 70 },
  phone: { entity: "learner", field: "phone", confidence: 70 },
  cellphone: { entity: "learner", field: "phone", confidence: 70 },
};

export interface FieldMapping {
  sourceField: string;
  entityType: ImportEntityType;
  targetField: string;
  automatic: boolean;
}

export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function autoMapHeaders(headers: string[], entityHint?: ImportEntityType): FieldMapping[] {
  return headers.map((sourceField) => {
    const key = normaliseHeader(sourceField);
    const alias = HEADER_ALIASES[key];
    if (alias && (!entityHint || alias.entity === entityHint || alias.confidence >= 85)) {
      return {
        sourceField,
        entityType: entityHint ?? alias.entity,
        targetField: alias.field,
        automatic: alias.confidence >= 70,
      };
    }
    const entity = entityHint ?? guessEntityFromSheet(headers);
    const targets = LMS_TARGET_FIELDS[entity];
    const target = targets.find((t) => normaliseHeader(t) === key) ?? "";
    return {
      sourceField,
      entityType: entity,
      targetField: target,
      automatic: Boolean(target),
    };
  });
}

export function guessEntityFromSheet(headers: string[]): ImportEntityType {
  const keys = headers.map(normaliseHeader);
  if (keys.some((k) => k.includes("admission") || k.includes("learner") || k.includes("studentnumber"))) {
    return "learner";
  }
  if (keys.some((k) => k.includes("guardian") || k.includes("parent"))) return "guardian";
  if (keys.some((k) => k.includes("educator") || k.includes("teacher") || k.includes("employee"))) {
    return "educator";
  }
  if (keys.some((k) => k.includes("subject"))) return "subject";
  if (keys.some((k) => k.includes("class"))) return "class";
  if (keys.some((k) => k.includes("grade"))) return "grade";
  return "unknown";
}

export function applyMapping(
  row: Record<string, string>,
  mappings: FieldMapping[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const mapping of mappings) {
    if (!mapping.targetField) continue;
    out[mapping.targetField] = row[mapping.sourceField] ?? "";
  }
  return out;
}

export function guessEntityFromFilename(name: string): ImportEntityType | undefined {
  const lower = name.toLowerCase();
  if (lower.includes("learner") || lower.includes("student")) return "learner";
  if (lower.includes("parent") || lower.includes("guardian")) return "guardian";
  if (lower.includes("teacher") || lower.includes("educator") || lower.includes("staff")) return "educator";
  if (lower.includes("subject")) return "subject";
  if (lower.includes("class")) return "class";
  if (lower.includes("grade")) return "grade";
  if (lower.includes("school")) return "school";
  return undefined;
}
