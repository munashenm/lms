export const BACKUP_MAGIC = "LMSBACKUP";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_COMPATIBILITY_VERSION = 1;
export const BACKUP_EXTENSION = ".lmsbackup";

export interface BackupManifest {
  backupVersion: number;
  compatibilityVersion: number;
  applicationVersion: string;
  schemaVersion: string;
  institutionId: string;
  institutionName: string;
  createdAt: string;
  learnerCount: number;
  userCount: number;
  fileCount: number;
  checksum: string;
  encryption: {
    alg: "aes-256-gcm";
    kdf: "sha256";
    iv: string;
    authTag: string;
  };
  type: "CLOUD_SCHEDULED" | "CLOUD_MANUAL" | "OFFLINE" | "PRE_RESTORE";
}

export interface BackupSnapshot {
  school: Record<string, unknown>;
  campuses: Record<string, unknown>[];
  users: Record<string, unknown>[];
  academicYears: Record<string, unknown>[];
  terms: Record<string, unknown>[];
  grades: Record<string, unknown>[];
  subjects: Record<string, unknown>[];
  courses: Record<string, unknown>[];
  modules: Record<string, unknown>[];
  classes: Record<string, unknown>[];
  classSubjects: Record<string, unknown>[];
  classTeachers: Record<string, unknown>[];
  students: Record<string, unknown>[];
  teachers: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  studentGuardians: Record<string, unknown>[];
  enrolments: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  attendanceRecords: Record<string, unknown>[];
  staffAttendanceRecords: Record<string, unknown>[];
  timetableSlots: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  assignmentSubmissions: Record<string, unknown>[];
  marks: Record<string, unknown>[];
  reportCards: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  invoiceLineItems: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  feeScheduleItems: Record<string, unknown>[];
  feeReminderRules: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  announcements: Record<string, unknown>[];
  certificates: Record<string, unknown>[];
  leaveRequests: Record<string, unknown>[];
  ledgerEntries: Record<string, unknown>[];
  studentLedgerEntries: Record<string, unknown>[];
  communicationLogs: Record<string, unknown>[];
  communicationBatches: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  files: { relativePath: string; contentBase64: string; mimeType?: string }[];
}

export const SECRET_BACKUP_FIELDS = [
  "passwordResetTokenHash",
  "sendgridApiKey",
  "twilioAuthToken",
  "payfastMerchantKey",
  "payfastPassphrase",
  "ozowPrivateKey",
  "yocoSecretKey",
  "yocoWebhookSecret",
] as const;
