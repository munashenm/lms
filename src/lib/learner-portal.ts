import type { LeaveStatus } from "@prisma/client";

export const STUDENT_ABSENCE_TYPES = [
  "SICK",
  "FAMILY",
  "PERSONAL",
  "SCHOOL_ACTIVITY",
  "OTHER",
] as const;

export type StudentAbsenceTypeValue = (typeof STUDENT_ABSENCE_TYPES)[number];

export const STUDENT_ABSENCE_TYPE_LABELS: Record<StudentAbsenceTypeValue, string> = {
  SICK: "Sick",
  FAMILY: "Family",
  PERSONAL: "Personal",
  SCHOOL_ACTIVITY: "School activity",
  OTHER: "Other",
};

export type AssignmentLearnerStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "LATE"
  | "OVERDUE"
  | "MARKED"
  | "RETURNED";

export function assignmentLearnerStatus(opts: {
  submitted: boolean;
  submittedAt?: Date | string | null;
  dueDate?: Date | string | null;
  grade?: number | null;
  feedback?: string | null;
  now?: Date;
}): AssignmentLearnerStatus {
  const now = opts.now ?? new Date();
  const due = opts.dueDate ? new Date(opts.dueDate) : null;
  const submittedAt = opts.submittedAt ? new Date(opts.submittedAt) : null;
  const marked = opts.grade !== null && opts.grade !== undefined;
  const returned = marked && Boolean(opts.feedback);

  if (returned) return "RETURNED";
  if (marked) return "MARKED";
  if (opts.submitted) {
    if (due && submittedAt && submittedAt > due) return "LATE";
    return "SUBMITTED";
  }
  if (due && now > due) return "OVERDUE";
  return "NOT_STARTED";
}

export function canLearnerResubmit(opts: {
  dueDate?: Date | string | null;
  allowLate: boolean;
  now?: Date;
}): boolean {
  if (!opts.dueDate) return true;
  if (opts.allowLate) return true;
  return (opts.now ?? new Date()) <= new Date(opts.dueDate);
}

export type ExamWindow = "UPCOMING" | "AVAILABLE" | "COMPLETED";

/** Listing helper for exam availability windows used by learner and parent portals. */
export function examWindow(opts: {
  availableFrom?: Date | string | null;
  dueDate?: Date | string | null;
  completed: boolean;
  now?: Date;
}): ExamWindow {
  if (opts.completed) return "COMPLETED";
  const now = opts.now ?? new Date();
  const start = opts.availableFrom ? new Date(opts.availableFrom) : null;
  const end = opts.dueDate ? new Date(opts.dueDate) : null;
  if (start && now < start) return "UPCOMING";
  if (end && now > end) return "COMPLETED";
  return "AVAILABLE";
}

export function nextAbsenceStatus(
  current: LeaveStatus,
  action: "approve" | "reject" | "cancel"
): LeaveStatus | null {
  if (current !== "PENDING") return null;
  if (action === "approve") return "APPROVED";
  if (action === "reject") return "REJECTED";
  if (action === "cancel") return "CANCELLED";
  return null;
}

export function absenceRangesOverlap(
  aFrom: Date,
  aTo: Date,
  bFrom: Date,
  bTo: Date
): boolean {
  return aFrom.getTime() <= bTo.getTime() && bFrom.getTime() <= aTo.getTime();
}

export function teacherTeachesLearner(opts: {
  learnerClassId: string | null;
  teacherId: string;
  classTeachers: Array<{ classId: string; teacherId: string }>;
  classSubjects: Array<{ classId: string; teacherId: string | null }>;
}): boolean {
  if (!opts.learnerClassId) return false;
  if (
    opts.classTeachers.some(
      (row) => row.classId === opts.learnerClassId && row.teacherId === opts.teacherId
    )
  ) {
    return true;
  }
  return opts.classSubjects.some(
    (row) => row.classId === opts.learnerClassId && row.teacherId === opts.teacherId
  );
}

export function clampReviewScore(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export type LearnerDocumentTarget = {
  isPublic: boolean;
  learnerVisible?: boolean;
  targetGradeId?: string | null;
  targetClassId?: string | null;
  targetCampusId?: string | null;
  targetCourseId?: string | null;
  targetStudentId?: string | null;
};

export type LearnerDocumentScope = {
  id: string;
  gradeId: string | null;
  classId: string | null;
  campusId: string | null;
  courseIds: string[];
};

export function documentVisibleToLearner(
  doc: LearnerDocumentTarget,
  learner: LearnerDocumentScope
): boolean {
  if (!doc.isPublic && !doc.learnerVisible) return false;
  if (doc.targetStudentId && doc.targetStudentId !== learner.id) return false;
  if (doc.targetClassId && doc.targetClassId !== learner.classId) return false;
  if (doc.targetGradeId && doc.targetGradeId !== learner.gradeId) return false;
  if (doc.targetCampusId && doc.targetCampusId !== learner.campusId) return false;
  if (doc.targetCourseId && !learner.courseIds.includes(doc.targetCourseId)) return false;
  return true;
}

export function attendanceSummary(records: Array<{ status: string }>) {
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const total = records.length;
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
  return { present, absent, late, excused, total, percentage };
}

export function curriculumProgress(topics: Array<{ status: string }>) {
  const completed = topics.filter((t) => t.status === "COMPLETED").length;
  const current = topics.filter((t) => t.status === "CURRENT").length;
  const upcoming = topics.filter((t) => t.status === "PLANNED").length;
  const total = topics.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, current, upcoming, total, percentage };
}

export function calendarAssessmentLabel(opts: {
  type: string;
  title: string;
  homeworkLabel: string;
}): string {
  if (opts.type === "EXAM") return `Exam: ${opts.title}`;
  if (opts.type === "ASSIGNMENT") return `${opts.homeworkLabel}: ${opts.title}`;
  return `Assessment: ${opts.title}`;
}

export const DOWNLOAD_CATEGORY_LABELS: Record<string, string> = {
  LEARNING_MATERIAL: "Study Material",
  ASSIGNMENT: "Academic Documents",
  REPORT_CARD: "Exam Documents",
  CERTIFICATE: "Academic Documents",
  TRANSCRIPT: "Academic Documents",
  ID_DOCUMENT: "Forms",
  INVOICE: "Other",
  RECEIPT: "Other",
  OTHER: "Other",
};

export function maskIdentityNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length < 5) return "••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-2)}`;
}
