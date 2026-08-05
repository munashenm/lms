import { EnrolmentStatus, type Prisma } from "@prisma/client";
import { prisma } from "./db";

/** Ensure a student has a session enrolment for the given (or current) academic year. */
export async function ensureStudentEnrolment(params: {
  studentId: string;
  schoolId: string;
  academicYearId?: string | null;
  courseId?: string | null;
  gradeId?: string | null;
  classId?: string | null;
  status?: EnrolmentStatus;
}): Promise<void> {
  let academicYearId = params.academicYearId;
  if (!academicYearId) {
    const current = await prisma.academicYear.findFirst({
      where: { schoolId: params.schoolId, isCurrent: true },
      select: { id: true },
    });
    academicYearId = current?.id ?? null;
  }
  if (!academicYearId) return;

  const existing = await prisma.enrolment.findFirst({
    where: {
      studentId: params.studentId,
      academicYearId,
      ...(params.courseId ? { courseId: params.courseId } : { courseId: null }),
    },
  });

  if (existing) {
    await prisma.enrolment.update({
      where: { id: existing.id },
      data: {
        gradeId: params.gradeId ?? existing.gradeId,
        classId: params.classId ?? existing.classId,
        courseId: params.courseId ?? existing.courseId,
        status: params.status ?? existing.status,
      },
    });
    return;
  }

  await prisma.enrolment.create({
    data: {
      studentId: params.studentId,
      academicYearId,
      courseId: params.courseId ?? null,
      gradeId: params.gradeId ?? null,
      classId: params.classId ?? null,
      status: params.status ?? EnrolmentStatus.ENROLLED,
    },
  });
}

export const enrolmentListInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      status: true,
    },
  },
  academicYear: { select: { id: true, name: true, isCurrent: true } },
  grade: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  course: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EnrolmentInclude;
