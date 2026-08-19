import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedLearner } from "@/lib/learner-scope";
import { teacherReviewSchema } from "@/lib/validators";
import { teacherTeachesLearner } from "@/lib/learner-portal";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET() {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const [classTeachers, classSubjects, reviews] = await Promise.all([
    student.classId
      ? prisma.classTeacher.findMany({
          where: { classId: student.classId },
          include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    student.classId
      ? prisma.classSubject.findMany({
          where: { classId: student.classId, teacherId: { not: null } },
          include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    prisma.teacherReview.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const teachers = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const row of classTeachers) teachers.set(row.teacher.id, row.teacher);
  for (const row of classSubjects) {
    if (row.teacher) teachers.set(row.teacher.id, row.teacher);
  }

  return NextResponse.json({
    teachers: [...teachers.values()],
    reviews,
    anonymous: student.school.teacherReviewsAnonymous,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const denied = await requireLicenseWrite(student.schoolId, { feature: "teacher_reviews" });
  if (denied) return denied;

  const parsed = teacherReviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const [classTeachers, classSubjects] = await Promise.all([
    prisma.classTeacher.findMany({
      where: { classId: student.classId ?? "__none__" },
      select: { classId: true, teacherId: true },
    }),
    prisma.classSubject.findMany({
      where: { classId: student.classId ?? "__none__" },
      select: { classId: true, teacherId: true },
    }),
  ]);

  if (
    !teacherTeachesLearner({
      learnerClassId: student.classId,
      teacherId: parsed.data.teacherId,
      classTeachers,
      classSubjects,
    })
  ) {
    return NextResponse.json({ message: "You can only review teachers who currently teach you" }, { status: 403 });
  }

  const currentYear =
    student.enrolments.find((e) => e.academicYear?.isCurrent)?.academicYear?.name ??
    student.enrolments[0]?.academicYear?.name ??
    new Date().getFullYear().toString();

  try {
    const review = await prisma.teacherReview.create({
      data: {
        schoolId: student.schoolId,
        studentId: student.id,
        teacherId: parsed.data.teacherId,
        periodKey: currentYear,
        teachingQuality: parsed.data.teachingQuality,
        communication: parsed.data.communication,
        preparedness: parsed.data.preparedness,
        subjectKnowledge: parsed.data.subjectKnowledge,
        availability: parsed.data.availability,
        overall: parsed.data.overall,
        comment: parsed.data.comment || null,
        isAnonymous: student.school.teacherReviewsAnonymous,
      },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "You have already submitted a review for this teacher in the current period" },
      { status: 409 }
    );
  }
}
