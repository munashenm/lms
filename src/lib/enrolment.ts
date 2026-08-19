import { EnrolmentStatus, type Prisma } from "@prisma/client";
import { prisma } from "./db";
import { applyEnrolmentFees, syncEnrolmentModules } from "./fee-engine";

/** Ensure a student has a session enrolment for the given (or current) academic year. */
export async function ensureStudentEnrolment(params: {
  studentId: string;
  schoolId: string;
  academicYearId?: string | null;
  courseId?: string | null;
  gradeId?: string | null;
  classId?: string | null;
  status?: EnrolmentStatus;
  moduleIds?: string[];
  hostel?: boolean;
  transport?: boolean;
  recordedById?: string | null;
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

  let enrolmentId: string;
  if (existing) {
    const updated = await prisma.enrolment.update({
      where: { id: existing.id },
      data: {
        gradeId: params.gradeId ?? existing.gradeId,
        classId: params.classId ?? existing.classId,
        courseId: params.courseId ?? existing.courseId,
        status: params.status ?? existing.status,
      },
    });
    enrolmentId = updated.id;
  } else {
    const created = await prisma.enrolment.create({
      data: {
        studentId: params.studentId,
        academicYearId,
        courseId: params.courseId ?? null,
        gradeId: params.gradeId ?? null,
        classId: params.classId ?? null,
        status: params.status ?? EnrolmentStatus.ENROLLED,
      },
    });
    enrolmentId = created.id;
  }

  if (params.moduleIds) {
    await syncEnrolmentModules(enrolmentId, params.moduleIds);
  }

  const modules = await prisma.enrolmentModule.findMany({
    where: { enrolmentId },
    select: { moduleId: true },
  });
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { campusId: true },
  });

  await applyEnrolmentFees({
    studentId: params.studentId,
    schoolId: params.schoolId,
    academicYearId,
    enrolmentId,
    courseId: params.courseId,
    gradeId: params.gradeId,
    classId: params.classId,
    campusId: student?.campusId,
    moduleIds: modules.map((m) => m.moduleId),
    hostel: params.hostel,
    transport: params.transport,
    recordedById: params.recordedById,
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
