import { z } from "zod";
import { validateSAIdNumber, validateSAPhone } from "./sa-validation";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  studentNumber: z.string().min(1, "Student number is required"),
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
});

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  gradeId: z.string().optional(),
  campusId: z.string().optional(),
  academicYearId: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  room: z.string().optional(),
});

export const gradeSchema = z.object({
  name: z.string().min(1, "Grade name is required"),
  level: z.coerce.number().int().optional(),
  phase: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const subjectSchema = z.object({
  code: z.string().min(1, "Subject code is required"),
  name: z.string().min(1, "Subject name is required"),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  credits: z.coerce.number().int().positive().optional(),
});

export const courseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  name: z.string().min(1, "Course name is required"),
  description: z.string().optional(),
  nqfLevel: z.coerce.number().int().positive().optional(),
  durationMonths: z.coerce.number().int().positive().optional(),
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
  classId: z.string().min(1),
  date: z.string().min(1),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      notes: z.string().optional(),
    })
  ),
});

export const staffAttendanceBulkSchema = z.object({
  date: z.string().min(1),
  records: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "ON_LEAVE", "REMOTE"]),
      checkIn: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
});

export const staffAttendanceSelfSchema = z.object({
  status: z.enum(["PRESENT", "LATE", "REMOTE"]),
  notes: z.string().optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  audience: z.enum(["ALL", "STUDENTS", "PARENTS", "STAFF", "TEACHERS", "FINANCE"]).default("ALL"),
  isPinned: z.boolean().optional(),
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
});

export const applicationStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED", "WITHDRAWN"]),
  notes: z.string().optional(),
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
  method: z.enum(["CASH", "EFT", "CARD", "PAYFAST", "OZOW", "YOCO", "SCHOLARSHIP", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const certificateSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["COMPLETION", "GRADUATION", "MERIT", "ATTENDANCE"]).default("COMPLETION"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  courseId: z.string().optional(),
  academicYearId: z.string().optional(),
});

export const leaveRequestSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "FAMILY", "UNPAID", "OTHER"]),
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
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  popiaConsentText: z.string().optional(),
  registrationNo: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
