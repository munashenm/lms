import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTeacherForSession } from "@/lib/portal-data";
import { licenseDeniedResponse, licenseWriteGuard } from "@/lib/licensing/enforce";

interface RouteParams {
  params: Promise<{ id: string; questionId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id, questionId } = await params;
  const question = await prisma.examQuestion.findFirst({
    where: { id: questionId, assessmentId: id },
    include: {
      assessment: {
        include: {
          subject: { select: { schoolId: true } },
          module: { select: { course: { select: { schoolId: true } } } },
        },
      },
    },
  });
  if (!question) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const teacher = session!.role === "TEACHER" ? await getTeacherForSession(session!) : null;
  if (teacher && question.assessment.teacherId && question.assessment.teacherId !== teacher.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const started = await prisma.examAttempt.count({ where: { assessmentId: id } });
  if (started > 0) {
    return NextResponse.json(
      { message: "Questions cannot be removed after a learner has started this exam" },
      { status: 409 }
    );
  }

  const schoolId =
    question.assessment.subject?.schoolId ??
    question.assessment.module?.course.schoolId ??
    session!.schoolId;
  if (schoolId) {
    const guard = await licenseWriteGuard({ schoolId, feature: "online_exams", action: "write" });
    if (!guard.ok) return licenseDeniedResponse(guard);
  }

  await prisma.examQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
