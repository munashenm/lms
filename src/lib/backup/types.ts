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
  feeStructures?: Record<string, unknown>[];
  studentCharges?: Record<string, unknown>[];
  chargeInstalments?: Record<string, unknown>[];
  paymentAllocations?: Record<string, unknown>[];
  creditNotes?: Record<string, unknown>[];
  refunds?: Record<string, unknown>[];
  studentAidAwards?: Record<string, unknown>[];
  suppliers?: Record<string, unknown>[];
  expenseCategories?: Record<string, unknown>[];
  incomeCategories?: Record<string, unknown>[];
  financialAccounts?: Record<string, unknown>[];
  expenses?: Record<string, unknown>[];
  recurringExpenses?: Record<string, unknown>[];
  otherIncomes?: Record<string, unknown>[];
  employees?: Record<string, unknown>[];
  employmentContracts?: Record<string, unknown>[];
  salaryStructures?: Record<string, unknown>[];
  employeeDocuments?: Record<string, unknown>[];
  leavePolicies?: Record<string, unknown>[];
  leaveEntitlements?: Record<string, unknown>[];
  timesheets?: Record<string, unknown>[];
  timesheetEntries?: Record<string, unknown>[];
  payrollRuleSets?: Record<string, unknown>[];
  payrollRuns?: Record<string, unknown>[];
  payrollItems?: Record<string, unknown>[];
  payslips?: Record<string, unknown>[];
  enrolmentModules?: Record<string, unknown>[];
  studentAbsenceRequests?: Record<string, unknown>[];
  teacherReviews?: Record<string, unknown>[];
  lessonPlans?: Record<string, unknown>[];
  curriculumTopics?: Record<string, unknown>[];
  visitorEntries?: Record<string, unknown>[];
  studentDocuments?: Record<string, unknown>[];
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
  "bankAccountEnc",
] as const;
