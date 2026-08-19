import { StudentStatus } from "@prisma/client";
import { prisma } from "./db";
import { ensureStudentEnrolment } from "./enrolment";
import { generateStudentNumber } from "./students";
import { logAudit } from "./audit";

export function normalizeAppliedName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchGradeId(
  grades: Array<{ id: string; name: string }>,
  gradeApplied: string | null | undefined
): string | null {
  const needle = normalizeAppliedName(gradeApplied);
  if (!needle) return null;
  const exact = grades.find((grade) => normalizeAppliedName(grade.name) === needle);
  if (exact) return exact.id;
  const withoutPrefix = needle.replace(/^grade\s+/, "");
  const loose = grades.find((grade) => {
    const name = normalizeAppliedName(grade.name).replace(/^grade\s+/, "");
    return name === withoutPrefix;
  });
  return loose?.id ?? null;
}

export function matchCourseId(
  courses: Array<{ id: string; name: string; code: string }>,
  courseApplied: string | null | undefined
): string | null {
  const needle = normalizeAppliedName(courseApplied);
  if (!needle) return null;
  const match = courses.find(
    (course) =>
      normalizeAppliedName(course.code) === needle || normalizeAppliedName(course.name) === needle
  );
  return match?.id ?? null;
}

export function shouldCreateStudentOnAccept(input: {
  nextStatus: string;
  studentId: string | null | undefined;
}): boolean {
  return input.nextStatus === "ACCEPTED" && !input.studentId;
}

export async function findStudentForApplication(application: {
  schoolId: string;
  studentId: string | null;
  saIdNumber: string | null;
}): Promise<string | null> {
  if (application.studentId) return application.studentId;
  if (!application.saIdNumber) return null;
  const existing = await prisma.student.findFirst({
    where: { schoolId: application.schoolId, saIdNumber: application.saIdNumber },
    select: { id: true },
  });
  return existing?.id ?? null;
}

export async function enrolFromAcceptedApplication(params: {
  application: {
    id: string;
    schoolId: string;
    studentId: string | null;
    firstName: string;
    lastName: string;
    saIdNumber: string | null;
    email: string | null;
    phone: string | null;
    gradeApplied: string | null;
    courseApplied: string | null;
  };
  existingStudentId?: string | null;
  actorId: string;
  hostel?: boolean;
  transport?: boolean;
}): Promise<{ studentId: string; studentNumber: string; created: boolean }> {
  const [grades, courses] = await Promise.all([
    prisma.grade.findMany({
      where: { schoolId: params.application.schoolId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.course.findMany({
      where: { schoolId: params.application.schoolId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);
  const gradeId = matchGradeId(grades, params.application.gradeApplied);
  const courseId = matchCourseId(courses, params.application.courseApplied);

  let studentId = params.existingStudentId ?? params.application.studentId;
  let created = false;
  let studentNumber: string | null = null;

  if (studentId) {
    const existing = await prisma.student.findFirst({
      where: { id: studentId, schoolId: params.application.schoolId },
      select: { id: true, studentNumber: true },
    });
    if (!existing) throw new Error("Linked student was not found");
    studentNumber = existing.studentNumber;
  } else {
    studentNumber = await generateStudentNumber(params.application.schoolId);
    const student = await prisma.student.create({
      data: {
        schoolId: params.application.schoolId,
        firstName: params.application.firstName,
        lastName: params.application.lastName,
        studentNumber,
        saIdNumber: params.application.saIdNumber,
        email: params.application.email,
        phone: params.application.phone,
        gradeId,
        status: StudentStatus.ACTIVE,
        enrolledAt: new Date(),
      },
    });
    studentId = student.id;
    created = true;
  }

  await ensureStudentEnrolment({
    studentId,
    schoolId: params.application.schoolId,
    gradeId,
    courseId,
    hostel: params.hostel ? true : undefined,
    transport: params.transport ? true : undefined,
    recordedById: params.actorId,
  });

  await logAudit({
    schoolId: params.application.schoolId,
    userId: params.actorId,
    action: created ? "CREATE" : "UPDATE",
    entity: "Student",
    entityId: studentId,
    metadata: { source: "application", applicationId: params.application.id },
  });

  return { studentId, studentNumber, created };
}
