import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { getStudentForSession } from "./portal-data";

export async function requireAuthenticatedLearner(session: SessionPayload | null) {
  if (!session || session.role !== UserRole.STUDENT) return null;
  const student = await getStudentForSession(session);
  return student;
}

export async function getLearnerDocumentScope(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      gradeId: true,
      classId: true,
      campusId: true,
      enrolments: { select: { courseId: true } },
    },
  });
  if (!student) return null;
  return {
    id: student.id,
    gradeId: student.gradeId,
    classId: student.classId,
    campusId: student.campusId,
    courseIds: student.enrolments
      .map((e) => e.courseId)
      .filter((id): id is string => Boolean(id)),
  };
}
