import { NextRequest, NextResponse } from "next/server";
import { AssessmentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { examWindow } from "@/lib/learner-portal";
import { isFeatureEnabled } from "@/lib/licensing/portal";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { publicExamQuestion } from "@/lib/online-exams";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const student = await getStudentForSession(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const license = await evaluateStoredLicense(student.schoolId).catch(() => null);
  if (!isFeatureEnabled(license, "online_exams")) {
    return NextResponse.json({ message: "Online examinations are not included in this licence" }, { status: 403 });
  }

  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      subject: { select: { schoolId: true } },
      module: { select: { course: { select: { schoolId: true } } } },
    },
  });

  if (
    !assessment ||
    assessment.type !== AssessmentType.EXAM ||
    !assessment.isPublished ||
    assessment.questions.length === 0
  ) {
    return NextResponse.json({ message: "Exam not available" }, { status: 404 });
  }

  const schoolId = assessment.subject?.schoolId ?? assessment.module?.course.schoolId;
  if (schoolId && schoolId !== student.schoolId) {
    return NextResponse.json({ message: "Exam not available" }, { status: 404 });
  }

  const existing = await prisma.examAttempt.findUnique({
    where: { assessmentId_studentId: { assessmentId: id, studentId: student.id } },
  });
  if (existing?.status === "SUBMITTED") {
    return NextResponse.json({ message: "You have already submitted this exam" }, { status: 400 });
  }

  const window = examWindow({
    availableFrom: assessment.availableFrom,
    dueDate: assessment.dueDate,
    completed: existing?.status === "SUBMITTED",
  });
  if (window !== "AVAILABLE") {
    return NextResponse.json({ message: "This exam is not open for sitting" }, { status: 400 });
  }

  const attempt =
    existing ??
    (await prisma.examAttempt.create({
      data: { assessmentId: id, studentId: student.id },
    }));

  return NextResponse.json({
    attempt: { id: attempt.id, startedAt: attempt.startedAt, durationMinutes: assessment.durationMinutes },
    questions: assessment.questions.map((q) =>
      publicExamQuestion({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        points: Number(q.points),
        sortOrder: q.sortOrder,
        correctAnswer: q.correctAnswer,
      })
    ),
  });
}
