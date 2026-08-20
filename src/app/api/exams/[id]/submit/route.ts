import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { examSubmitSchema } from "@/lib/validators";
import { examTimeRemainingMs, scoreExamResponse } from "@/lib/online-exams";
import { percentageToSymbol } from "@/lib/grading";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const student = await getStudentForSession(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const parsed = examSubmitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid answers" }, { status: 400 });
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { assessmentId_studentId: { assessmentId: id, studentId: student.id } },
    include: {
      assessment: { include: { questions: true } },
    },
  });

  if (!attempt || attempt.status === "SUBMITTED") {
    return NextResponse.json({ message: "No open attempt" }, { status: 400 });
  }

  const remaining = examTimeRemainingMs({
    startedAt: attempt.startedAt,
    durationMinutes: attempt.assessment.durationMinutes,
  });
  if (remaining === 0) {
    // Allow late submit after timer; still accept so the learner is not locked out.
  }

  const responseByQuestion = new Map(parsed.data.answers.map((row) => [row.questionId, row.response]));
  let total = 0;
  const scored = attempt.assessment.questions.map((question) => {
    const result = scoreExamResponse({
      type: question.type,
      correctAnswer: question.correctAnswer,
      points: Number(question.points),
      response: responseByQuestion.get(question.id) ?? "",
    });
    total += result.pointsAwarded;
    return { question, result, response: responseByQuestion.get(question.id) ?? "" };
  });

  await prisma.$transaction(async (tx) => {
    await tx.examAnswer.deleteMany({ where: { attemptId: attempt.id } });
    if (scored.length) {
      await tx.examAnswer.createMany({
        data: scored.map((row) => ({
          attemptId: attempt.id,
          questionId: row.question.id,
          response: row.response,
          isCorrect: row.result.isCorrect,
          pointsAwarded: row.result.pointsAwarded,
        })),
      });
    }
    await tx.examAttempt.update({
      where: { id: attempt.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), score: total },
    });
    await tx.mark.upsert({
      where: { assessmentId_studentId: { assessmentId: id, studentId: student.id } },
      create: {
        assessmentId: id,
        studentId: student.id,
        score: total,
        gradeSymbol: percentageToSymbol(
          Number(attempt.assessment.maxMarks) > 0
            ? (total / Number(attempt.assessment.maxMarks)) * 100
            : 0
        ),
      },
      update: {
        score: total,
        gradeSymbol: percentageToSymbol(
          Number(attempt.assessment.maxMarks) > 0
            ? (total / Number(attempt.assessment.maxMarks)) * 100
            : 0
        ),
      },
    });
  });

  return NextResponse.json({ score: total, maxMarks: Number(attempt.assessment.maxMarks) });
}
