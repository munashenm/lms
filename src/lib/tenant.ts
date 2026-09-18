import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { canAccessSchool } from "./rbac";

export function institutionScope(session: SessionPayload): { schoolId: string } | Record<string, never> {
  if (session.role === UserRole.SUPER_ADMIN) return {};
  if (!session.schoolId) return { schoolId: "__none__" };
  return { schoolId: session.schoolId };
}

/** Look up a tenant row by id without a follow-up canAccessSchool check. */
export function scopedId(session: SessionPayload, id: string) {
  return { id, ...institutionScope(session) };
}

export function requireBoundSchoolId(session: SessionPayload): string {
  if (session.schoolId) return session.schoolId;
  throw new Error("School context required");
}

export async function studentInSchool(studentId: string, schoolId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, schoolId: true, userId: true },
  });
}

export async function assertStudentsInSchool(studentIds: string[], schoolId: string): Promise<boolean> {
  const unique = [...new Set(studentIds)];
  if (unique.length === 0) return true;
  const count = await prisma.student.count({
    where: { id: { in: unique }, schoolId },
  });
  return count === unique.length;
}

export async function classInSchool(classId: string, schoolId: string) {
  return prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, schoolId: true },
  });
}

export async function assessmentAccess(assessmentId: string) {
  return prisma.assessment.findFirst({
    where: { id: assessmentId },
    select: {
      id: true,
      schoolId: true,
      teacherId: true,
      subject: { select: { schoolId: true } },
      module: { select: { course: { select: { schoolId: true } } } },
      teacher: { select: { schoolId: true } },
    },
  });
}

export const assessmentSchoolInclude = {
  subject: { select: { schoolId: true } },
  module: { select: { course: { select: { schoolId: true } } } },
  teacher: { select: { schoolId: true } },
} as const;

export function assessmentSchoolId(assessment: {
  schoolId?: string | null;
  subject?: { schoolId: string } | null;
  module?: { course: { schoolId: string } } | null;
  teacher?: { schoolId: string } | null;
}): string | null {
  return (
    assessment.schoolId ??
    assessment.subject?.schoolId ??
    assessment.module?.course.schoolId ??
    assessment.teacher?.schoolId ??
    null
  );
}

export function studentCanAccessAssessment(
  studentSchoolId: string,
  assessment: Parameters<typeof assessmentSchoolId>[0]
): boolean {
  const schoolId = assessmentSchoolId(assessment);
  return Boolean(schoolId && schoolId === studentSchoolId);
}

/** Learners may only query their own (or their children's) records. */
export function scopedStudentIdFilter(
  session: SessionPayload,
  queryStudentId: string | null | undefined,
  opts: { ownStudentId?: string | null; childIds?: string[] } = {}
): { studentId: string | { in: string[] } } | Record<string, never> {
  if (session.role === UserRole.STUDENT) {
    return { studentId: opts.ownStudentId || "__none__" };
  }
  if (session.role === UserRole.PARENT) {
    const childIds = opts.childIds ?? [];
    if (queryStudentId && childIds.includes(queryStudentId)) {
      return { studentId: queryStudentId };
    }
    return { studentId: { in: childIds.length ? childIds : ["__none__"] } };
  }
  if (queryStudentId) return { studentId: queryStudentId };
  return {};
}

export function enrolmentIdentityWhere(
  studentId: string,
  academicYearId: string,
  courseId?: string | null
) {
  return {
    studentId,
    academicYearId,
    courseId: courseId ?? null,
  };
}

export function denyCrossTenant(
  session: SessionPayload,
  resourceSchoolId: string | null | undefined
): boolean {
  if (!resourceSchoolId) return true;
  return !canAccessSchool(session, resourceSchoolId);
}

/** Always filter timetable rows by denormalized schoolId. */
export function scopedTimetableWhere(
  session: SessionPayload,
  classId?: string | null
) {
  return {
    ...(classId ? { classId } : {}),
    ...institutionScope(session),
  };
}

export async function assertUsersInSchool(userIds: string[], schoolId: string): Promise<boolean> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return true;
  const count = await prisma.user.count({
    where: { id: { in: unique }, schoolId },
  });
  return count === unique.length;
}

/** Reject cross-tenant foreign keys on create/update. Empty/null ids are skipped. */
export async function assertSchoolFks(
  schoolId: string,
  fks: {
    campusId?: string | null;
    subjectId?: string | null;
    teacherId?: string | null;
    termId?: string | null;
    moduleId?: string | null;
    userId?: string | null;
    supplierId?: string | null;
    expenseCategoryId?: string | null;
    incomeCategoryId?: string | null;
    financialAccountId?: string | null;
    gradeId?: string | null;
    classId?: string | null;
    academicYearId?: string | null;
    courseId?: string | null;
  }
): Promise<string | null> {
  const present = (id?: string | null): id is string => Boolean(id?.trim());
  if (present(fks.campusId)) {
    const row = await prisma.campus.findFirst({
      where: { id: fks.campusId, schoolId },
      select: { id: true },
    });
    if (!row) return "Campus is not in this institution";
  }
  if (present(fks.subjectId)) {
    const row = await prisma.subject.findFirst({
      where: { id: fks.subjectId, schoolId },
      select: { id: true },
    });
    if (!row) return "Subject is not in this institution";
  }
  if (present(fks.teacherId)) {
    const row = await prisma.teacher.findFirst({
      where: { id: fks.teacherId, schoolId },
      select: { id: true },
    });
    if (!row) return "Staff member is not in this institution";
  }
  if (present(fks.termId)) {
    const row = await prisma.term.findFirst({
      where: { id: fks.termId, academicYear: { schoolId } },
      select: { id: true },
    });
    if (!row) return "Term is not in this institution";
  }
  if (present(fks.moduleId)) {
    const row = await prisma.module.findFirst({
      where: { id: fks.moduleId, course: { schoolId } },
      select: { id: true },
    });
    if (!row) return "Module is not in this institution";
  }
  if (present(fks.gradeId)) {
    const row = await prisma.grade.findFirst({
      where: { id: fks.gradeId, schoolId },
      select: { id: true },
    });
    if (!row) return "Grade is not in this institution";
  }
  if (present(fks.classId)) {
    const row = await prisma.class.findFirst({
      where: { id: fks.classId, schoolId },
      select: { id: true },
    });
    if (!row) return "Class is not in this institution";
  }
  if (present(fks.academicYearId)) {
    const row = await prisma.academicYear.findFirst({
      where: { id: fks.academicYearId, schoolId },
      select: { id: true },
    });
    if (!row) return "Academic session is not in this institution";
  }
  if (present(fks.courseId)) {
    const row = await prisma.course.findFirst({
      where: { id: fks.courseId, schoolId },
      select: { id: true },
    });
    if (!row) return "Programme is not in this institution";
  }
  if (present(fks.userId)) {
    const row = await prisma.user.findFirst({
      where: { id: fks.userId, schoolId },
      select: { id: true },
    });
    if (!row) return "User is not in this institution";
  }
  if (present(fks.supplierId)) {
    const row = await prisma.supplier.findFirst({
      where: { id: fks.supplierId, schoolId },
      select: { id: true },
    });
    if (!row) return "Supplier is not in this institution";
  }
  if (present(fks.expenseCategoryId)) {
    const row = await prisma.expenseCategory.findFirst({
      where: { id: fks.expenseCategoryId, schoolId },
      select: { id: true },
    });
    if (!row) return "Expense category is not in this institution";
  }
  if (present(fks.incomeCategoryId)) {
    const row = await prisma.incomeCategory.findFirst({
      where: { id: fks.incomeCategoryId, schoolId },
      select: { id: true },
    });
    if (!row) return "Income category is not in this institution";
  }
  if (present(fks.financialAccountId)) {
    const row = await prisma.financialAccount.findFirst({
      where: { id: fks.financialAccountId, schoolId },
      select: { id: true },
    });
    if (!row) return "Account is not in this institution";
  }
  return null;
}

export async function assertDocumentTargets(opts: {
  schoolId: string;
  targetStudentId?: string | null;
  targetGradeId?: string | null;
  targetClassId?: string | null;
  targetCampusId?: string | null;
  targetCourseId?: string | null;
}): Promise<string | null> {
  if (opts.targetStudentId) {
    const row = await prisma.student.findFirst({
      where: { id: opts.targetStudentId, schoolId: opts.schoolId },
      select: { id: true },
    });
    if (!row) return "Student is not in this institution";
  }
  if (opts.targetGradeId) {
    const row = await prisma.grade.findFirst({
      where: { id: opts.targetGradeId, schoolId: opts.schoolId },
      select: { id: true },
    });
    if (!row) return "Grade is not in this institution";
  }
  if (opts.targetClassId) {
    const row = await prisma.class.findFirst({
      where: { id: opts.targetClassId, schoolId: opts.schoolId },
      select: { id: true },
    });
    if (!row) return "Class is not in this institution";
  }
  if (opts.targetCampusId) {
    const row = await prisma.campus.findFirst({
      where: { id: opts.targetCampusId, schoolId: opts.schoolId },
      select: { id: true },
    });
    if (!row) return "Campus is not in this institution";
  }
  if (opts.targetCourseId) {
    const row = await prisma.course.findFirst({
      where: { id: opts.targetCourseId, schoolId: opts.schoolId },
      select: { id: true },
    });
    if (!row) return "Programme is not in this institution";
  }
  return null;
}
