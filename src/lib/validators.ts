import { z } from "zod";
import { validateSAIdNumber, validateSAPhone } from "./sa-validation";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  studentNumber: z.string().max(40).optional().or(z.literal("")),
  saIdNumber: z
    .string()
    .optional()
    .refine((val) => !val || validateSAIdNumber(val), {
      message: "Invalid 13-digit SA ID number",
    }),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  gradeId: z.string().optional(),
  classId: z.string().optional(),
  campusId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  status: z
    .enum(["APPLICANT", "ACTIVE", "SUSPENDED", "GRADUATED", "WITHDRAWN"])
    .default("ACTIVE"),
  popiaConsent: z.boolean().optional(),
  hostel: z.boolean().optional(),
  transport: z.boolean().optional(),
});

export const studentGuardianSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  relationship: z.string().optional(),
});

export const studentPatchSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100).optional(),
  lastName: z.string().min(1, "Last name is required").max(100).optional(),
  saIdNumber: z
    .string()
    .optional()
    .refine((val) => !val || validateSAIdNumber(val), {
      message: "Invalid 13-digit SA ID number",
    }),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().or(z.literal("")),
  gradeId: z.string().optional(),
  classId: z.string().optional(),
  campusId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  status: z.enum(["APPLICANT", "ACTIVE", "SUSPENDED", "GRADUATED", "WITHDRAWN"]).optional(),
  invitePortal: z.boolean().optional(),
});

export const teacherPatchSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  department: z.string().optional(),
  campusId: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  invitePortal: z.boolean().optional(),
});

export const userInviteSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum(["STAFF", "FINANCE_OFFICER", "HR_OFFICER", "ADMISSIONS_OFFICER", "PRINCIPAL", "SCHOOL_ADMIN"]),
  schoolId: z.string().optional(),
});

export const userPatchSchema = z.object({
  isActive: z.boolean().optional(),
  resendInvite: z.boolean().optional(),
});

export const teacherSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  employeeNumber: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  department: z.string().optional(),
  campusId: z.string().optional(),
  saIdNumber: z.string().optional(),
});

export const campusSchema = z.object({
  name: z.string().min(1, "Campus name is required").max(120),
  code: z.string().min(1, "Campus code is required").max(20),
  address: z.string().optional(),
  isMain: z.boolean().optional(),
});

export const campusPatchSchema = campusSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  gradeId: z.string().optional(),
  campusId: z.string().optional(),
  academicYearId: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  room: z.string().optional(),
  teacherId: z.string().optional(),
});

export const classPatchSchema = classSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const gradeSchema = z.object({
  name: z.string().min(1, "Grade name is required"),
  level: z.coerce.number().int().optional(),
  phase: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const gradePatchSchema = z.object({
  name: z.string().min(1, "Grade name is required").optional(),
  level: z.coerce.number().int().optional(),
  phase: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const subjectSchema = z.object({
  code: z.string().min(1, "Subject code is required"),
  name: z.string().min(1, "Subject name is required"),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  credits: z.coerce.number().int().positive().optional(),
});

export const subjectPatchSchema = subjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const courseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  name: z.string().min(1, "Course name is required"),
  description: z.string().optional(),
  nqfLevel: z.coerce.number().int().positive().optional(),
  durationMonths: z.coerce.number().int().positive().optional(),
});

export const coursePatchSchema = courseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const moduleSchema = z.object({
  code: z.string().min(1, "Module code is required"),
  name: z.string().min(1, "Module name is required"),
  description: z.string().optional(),
  credits: z.coerce.number().int().positive().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const timetableSlotSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().optional(),
  moduleId: z.string().optional(),
  teacherId: z.string().optional(),
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  room: z.string().optional(),
});

export const attendanceBulkSchema = z.object({
  classId: z.string().optional().nullable(),
  moduleId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  sessionStart: z.string().optional().nullable(),
  sessionEnd: z.string().optional().nullable(),
  date: z.string().min(1),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"]),
      notes: z.string().optional(),
    })
  ),
}).refine((data) => Boolean(data.classId || data.moduleId), {
  message: "classId or moduleId is required",
});

export const staffAttendanceBulkSchema = z.object({
  date: z.string().min(1),
  records: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "ON_LEAVE", "REMOTE"]),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
});

export const staffAttendanceSelfSchema = z.object({
  status: z.enum(["PRESENT", "LATE", "REMOTE"]).optional(),
  notes: z.string().optional(),
  action: z.enum(["checkin", "checkout"]).default("checkin"),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  audience: z.enum(["ALL", "STUDENTS", "PARENTS", "STAFF", "TEACHERS", "FINANCE"]).default("ALL"),
  isPinned: z.boolean().optional(),
});

export const noticeComposeSchema = z.object({
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
  category: z.enum(["GENERAL", "ACADEMIC_NOTICE", "EXAM_NOTICE", "ANNOUNCEMENT", "EMERGENCY"]).default("GENERAL"),
  audience: z.enum(["STUDENT", "CLASS", "GRADE", "PARENTS", "STUDENTS", "STAFF"]),
  studentId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  gradeId: z.string().optional().nullable(),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required"),
  processImmediately: z.boolean().optional(),
});

export const refundPatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

const optionalSecret = z.string().optional();

export const integrationSettingsSchema = z.object({
  schoolId: z.string().optional(),
  sendgrid: z
    .object({
      enabled: z.boolean(),
      apiKey: optionalSecret,
      fromEmail: z.string().optional(),
      fromName: z.string().optional(),
    })
    .optional(),
  twilio: z
    .object({
      enabled: z.boolean(),
      accountSid: optionalSecret,
      authToken: optionalSecret,
      fromNumber: z.string().optional(),
    })
    .optional(),
  payfast: z
    .object({
      enabled: z.boolean(),
      merchantId: z.string().optional(),
      merchantKey: optionalSecret,
      passphrase: optionalSecret,
      sandbox: z.boolean().optional(),
    })
    .optional(),
  ozow: z
    .object({
      enabled: z.boolean(),
      siteCode: z.string().optional(),
      privateKey: optionalSecret,
      sandbox: z.boolean().optional(),
    })
    .optional(),
  yoco: z
    .object({
      enabled: z.boolean(),
      secretKey: optionalSecret,
      webhookSecret: optionalSecret,
    })
    .optional(),
});

export const assessmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["ASSIGNMENT", "TEST", "EXAM", "PROJECT", "PRACTICAL", "ORAL"]),
  subjectId: z.string().optional(),
  moduleId: z.string().optional(),
  termId: z.string().optional(),
  maxMarks: z.coerce.number().positive("Max marks must be positive"),
  weight: z.coerce.number().positive().optional(),
  dueDate: z.string().optional(),
  isAssignment: z.boolean().optional(),
  instructions: z.string().optional(),
});

export const marksBulkSchema = z.object({
  marks: z.array(
    z.object({
      studentId: z.string().min(1),
      score: z.coerce.number().min(0),
      comments: z.string().optional(),
    })
  ),
});

export const submissionSchema = z.object({
  content: z.string().optional(),
  fileUrl: z.string().optional(),
});

export const reportCardSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  termId: z.string().optional(),
  comments: z.string().optional(),
});

export const applicationSchema = z.object({
  schoolSlug: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  saIdNumber: z
    .string()
    .optional()
    .refine((val) => !val || validateSAIdNumber(val), {
      message: "Invalid 13-digit SA ID number",
    }),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  gradeApplied: z.string().optional(),
  courseApplied: z.string().optional(),
  notes: z.string().optional(),
  guardianFirstName: z.string().optional(),
  guardianLastName: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianPhone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  guardianRelationship: z.string().optional(),
});

export const applicationStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED", "WITHDRAWN"]),
  notes: z.string().optional(),
  hostel: z.boolean().optional(),
  transport: z.boolean().optional(),
});

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().positive(),
});

export const invoiceSchema = z.object({
  studentId: z.string().min(1),
  description: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  dueDate: z.string().optional(),
  status: z.enum(["DRAFT", "SENT"]).default("SENT"),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item required"),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum([
    "CASH",
    "EFT",
    "BANK_DEPOSIT",
    "CARD",
    "PAYFAST",
    "OZOW",
    "YOCO",
    "MOBILE",
    "SCHOLARSHIP",
    "OTHER",
  ]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  allocations: z
    .array(z.object({ instalmentId: z.string(), amount: z.coerce.number().positive() }))
    .optional(),
});

export const feeScheduleItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  amount: z.coerce.number().positive("Amount must be positive"),
  notes: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const feeScheduleItemUpdateSchema = feeScheduleItemSchema.partial();

export const feeReminderRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  daysOffset: z.coerce.number().int().min(-365).max(365),
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
  isEnabled: z.boolean().optional(),
  emailTemplate: z.string().max(5000).optional().nullable(),
  smsTemplate: z.string().max(480).optional().nullable(),
});

export const feeReminderRuleUpdateSchema = feeReminderRuleSchema.partial();

export const certificateSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["COMPLETION", "GRADUATION", "MERIT", "ATTENDANCE"]).default("COMPLETION"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  courseId: z.string().optional(),
  academicYearId: z.string().optional(),
});

export const leaveRequestSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "FAMILY", "MATERNITY", "STUDY", "UNPAID", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(5, "Please provide a reason"),
});

export const leaveStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  notes: z.string().optional(),
});

export const ledgerEntrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  reference: z.string().optional(),
  entryDate: z.string().min(1),
});

export const schoolSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || validateSAPhone(val), {
      message: "Phone must be 10 digits starting with 0",
    }),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  popiaConsentText: z.string().optional(),
  registrationNo: z.string().optional(),
  institutionType: z
    .enum([
      "SCHOOL",
      "PRIMARY_SCHOOL",
      "HIGH_SCHOOL",
      "COMBINED_SCHOOL",
      "COLLEGE",
      "TVET",
      "TRAINING_CENTRE",
      "TRAINING_INSTITUTION",
    ])
    .optional(),
  curriculumType: z.enum(["CAPS", "NSC", "TVET_NQF", "CUSTOM"]).optional(),
  periodStructure: z.enum(["TERMS_4", "SEMESTERS_2", "CUSTOM"]).optional(),
  absenceNotifyEnabled: z.coerce.boolean().optional(),
  teacherReviewsAnonymous: z.coerce.boolean().optional(),
  studentLeaveRequiresGuardian: z.coerce.boolean().optional(),
});

export const studentLedgerEntrySchema = z.object({
  studentId: z.string().min(1),
  type: z.enum([
    "CHARGE",
    "PAYMENT",
    "CREDIT",
    "DISCOUNT",
    "BURSARY",
    "SPONSORSHIP",
    "ADJUSTMENT",
    "REFUND",
  ]),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  reference: z.string().optional().nullable(),
  academicYearId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  entryDate: z.string().optional(),
});

export const academicYearSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
  createDefaultPeriods: z.boolean().optional(),
});

export const academicYearUpdateSchema = academicYearSchema.partial().extend({
  action: z
    .enum(["activate", "close", "archive", "reopen", "set_current"])
    .optional(),
});

export const termSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1, "Period name is required"),
  termNumber: z.coerce.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["PLANNED", "ACTIVE", "CLOSED"]).optional(),
  resultsPublishingDate: z.string().optional().nullable(),
  attendanceStartDate: z.string().optional().nullable(),
  attendanceEndDate: z.string().optional().nullable(),
  setCurrent: z.boolean().optional(),
});

export const termUpdateSchema = termSchema.partial().omit({ academicYearId: true }).extend({
  action: z.enum(["activate", "close", "set_current"]).optional(),
});

export const enrolmentSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  courseId: z.string().optional().nullable(),
  gradeId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  moduleIds: z.array(z.string()).optional(),
  hostel: z.boolean().optional(),
  transport: z.boolean().optional(),
  status: z
    .enum([
      "ENROLLED",
      "COMPLETED",
      "WITHDRAWN",
      "DEFERRED",
      "PROMOTED",
      "REPEATED",
      "GRADUATED",
      "TRANSFERRED",
    ])
    .optional(),
  notes: z.string().optional().nullable(),
});

export const rolloverOutcomeSchema = z.enum([
  "PROMOTED",
  "REPEATED",
  "GRADUATED",
  "WITHDRAWN",
  "TRANSFERRED",
  "COMPLETED",
]);

export const rolloverPreviewSchema = z.object({
  sourceYearId: z.string().min(1),
  targetYearId: z.string().min(1),
  gradeId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
});

export const rolloverCommitSchema = z.object({
  sourceYearId: z.string().min(1),
  targetYearId: z.string().min(1),
  activateTarget: z.boolean().optional(),
  closeSource: z.boolean().optional(),
  decisions: z
    .array(
      z.object({
        enrolmentId: z.string().min(1),
        studentId: z.string().min(1),
        outcome: rolloverOutcomeSchema,
        targetGradeId: z.string().optional().nullable(),
        targetClassId: z.string().optional().nullable(),
        targetCourseId: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentInput = z.infer<typeof studentSchema>;

export const learnerProfilePatchSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
});

export const studentAbsenceSchema = z.object({
  type: z.enum(["SICK", "FAMILY", "PERSONAL", "SCHOOL_ACTIVITY", "OTHER"]),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  reason: z.string().min(3),
  documentUrl: z.string().optional().nullable(),
});

export const parentStudentAbsenceSchema = studentAbsenceSchema.extend({
  studentId: z.string().min(1),
});

export const studentAbsenceReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().optional().nullable(),
});

export const teacherReviewSchema = z.object({
  teacherId: z.string().min(1),
  teachingQuality: z.coerce.number().int().min(1).max(5),
  communication: z.coerce.number().int().min(1).max(5),
  preparedness: z.coerce.number().int().min(1).max(5),
  subjectKnowledge: z.coerce.number().int().min(1).max(5),
  availability: z.coerce.number().int().min(1).max(5),
  overall: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
});

export const lessonPlanSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().optional().nullable(),
  termId: z.string().optional().nullable(),
  weekNumber: z.coerce.number().int().min(1).max(54).optional().nullable(),
  title: z.string().min(1),
  topic: z.string().min(1),
  objective: z.string().optional().nullable(),
  resources: z.string().optional().nullable(),
  readingMaterial: z.string().optional().nullable(),
  relatedAssessmentId: z.string().optional().nullable(),
  lessonDate: z.string().min(1),
  isPublished: z.coerce.boolean().optional(),
});

export const curriculumTopicSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().optional().nullable(),
  termId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  status: z.enum(["PLANNED", "CURRENT", "COMPLETED"]).optional(),
});

const optionalText = z.string().optional().nullable().or(z.literal(""));

export const visitorSignInSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    organisation: optionalText,
    phone: z
      .string()
      .optional()
      .nullable()
      .or(z.literal(""))
      .refine((val) => !val || validateSAPhone(val), {
        message: "Phone must be 10 digits starting with 0",
      }),
    identityType: z.preprocess(
      (value) => (value === "" ? null : value),
      z.enum(["SA_ID", "PASSPORT", "DRIVERS_LICENCE", "OTHER"]).optional().nullable()
    ),
    identityNumber: z.string().max(40).optional().nullable().or(z.literal("")),
    hostKind: z.enum(["STAFF", "LEARNER", "OTHER"]),
    hostName: z.string().min(1, "Who they are visiting is required").max(200),
    purpose: z.enum([
      "PARENT_GUARDIAN",
      "ENROLMENT",
      "DELIVERY",
      "CONTRACTOR",
      "OFFICIAL",
      "SPORTS_CULTURE",
      "MEETING",
      "OTHER",
    ]),
    purposeDetail: z.string().max(500).optional().nullable().or(z.literal("")),
    vehicleRegistration: z.string().max(20).optional().nullable().or(z.literal("")),
    badgeNumber: z.string().max(40).optional().nullable().or(z.literal("")),
    campusId: optionalText,
    notes: z.string().max(500).optional().nullable().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const idNumber = data.identityNumber?.trim();
    if (data.identityType === "SA_ID" && idNumber && !validateSAIdNumber(idNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid 13-digit SA ID number",
        path: ["identityNumber"],
      });
    }
  });

export const visitorSignOutSchema = z.object({
  action: z.literal("sign_out"),
});

