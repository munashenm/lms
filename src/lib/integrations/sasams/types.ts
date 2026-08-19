export const SASAMS_SOURCE = "SA-SAMS";

export type ImportEntityType =
  | "school"
  | "learner"
  | "guardian"
  | "educator"
  | "grade"
  | "class"
  | "subject"
  | "enrolment"
  | "assessment"
  | "mark"
  | "attendance"
  | "timetable"
  | "unknown";

export type ImportIssue = {
  severity: "ERROR" | "WARNING" | "INFORMATION";
  code: string;
  message: string;
  field?: string;
};

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ParsedSource {
  adapterId: string;
  format: string;
  sheets: ParsedSheet[];
  unrecognised: string[];
}

export interface StagedRecord {
  entityType: ImportEntityType;
  sourceRecordId?: string;
  sourceRow?: number;
  raw: Record<string, string>;
  mapped?: Record<string, string>;
}

export interface SASamsImporter {
  readonly id: string;
  readonly label: string;
  readonly versions: string[];
  detect(filename: string, mimeType: string | null, bytes: Buffer): number;
  parse(bytes: Buffer, filename: string): Promise<ParsedSource>;
}

export interface SASamsProvider {
  authenticate(): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  getSchool(): Promise<Record<string, unknown>>;
  getLearners(): Promise<Record<string, unknown>[]>;
  getEducators(): Promise<Record<string, unknown>[]>;
  getClasses(): Promise<Record<string, unknown>[]>;
  getSubjects(): Promise<Record<string, unknown>[]>;
  getAssessments(): Promise<Record<string, unknown>[]>;
  getAttendance(): Promise<Record<string, unknown>[]>;
  sync(): Promise<{ imported: number }>;
}

export const LMS_TARGET_FIELDS: Record<ImportEntityType, string[]> = {
  school: ["name", "registrationNo", "email", "phone", "address", "city", "province", "postalCode"],
  learner: [
    "firstName",
    "lastName",
    "studentNumber",
    "saIdNumber",
    "passportNumber",
    "dateOfBirth",
    "gender",
    "email",
    "phone",
    "grade",
    "class",
    "status",
  ],
  guardian: ["firstName", "lastName", "email", "phone", "saIdNumber", "relationship", "learnerStudentNumber"],
  educator: ["firstName", "lastName", "employeeNumber", "saIdNumber", "email", "phone", "department"],
  grade: ["name", "level", "phase"],
  class: ["name", "grade", "room"],
  subject: ["code", "name", "grade"],
  enrolment: ["studentNumber", "grade", "class", "academicYear"],
  assessment: ["title", "subject", "type", "maxMarks", "date"],
  mark: ["studentNumber", "assessment", "score"],
  attendance: ["studentNumber", "date", "status"],
  timetable: ["class", "subject", "dayOfWeek", "startTime", "endTime"],
  unknown: [],
};

export const MAX_IMPORT_BYTES = Number(process.env.IMPORT_MAX_FILE_BYTES ?? 50 * 1024 * 1024);
export const ALLOWED_IMPORT_MIME = [
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/json",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/octet-stream",
];
export const ALLOWED_IMPORT_EXT = [".csv", ".tsv", ".txt", ".json", ".xlsx", ".xls"];
