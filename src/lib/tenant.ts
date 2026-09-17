import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { canAccessSchool } from "./rbac";

export function institutionScope(session: SessionPayload): { schoolId: string } | Record<string, never> {
  if (session.role === UserRole.SUPER_ADMIN) return {};
  if (!session.schoolId) return { schoolId: "__none__" };
  return { schoolId: session.schoolId };
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
      teacherId: true,
      subject: { select: { schoolId: true } },
      module: { select: { course: { select: { schoolId: true } } } },
      teacher: { select: { schoolId: true } },
    },
  });
}

export function assessmentSchoolId(assessment: {
  subject?: { schoolId: string } | null;
  module?: { course: { schoolId: string } } | null;
  teacher?: { schoolId: string } | null;
}): string | null {
  return assessment.subject?.schoolId ?? assessment.module?.course.schoolId ?? assessment.teacher?.schoolId ?? null;
}

export function denyCrossTenant(
  session: SessionPayload,
  resourceSchoolId: string | null | undefined
): boolean {
  if (!resourceSchoolId) return true;
  return !canAccessSchool(session, resourceSchoolId);
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
