import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTeacherForSession } from "@/lib/portal-data";
import { examQuestionSchema } from "@/lib/validators";
import { asInputJson } from "@/lib/json";
import { licenseDeniedResponse, licenseWriteGuard } from "@/lib/licensing/enforce";
import { assessmentAccess, assessmentSchoolId } from "@/lib/tenant";
import { canAccessSchool } from "@/lib/rbac";
import { tenantMiss } from "@/lib/authorize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const access = await assessmentAccess(id);
  const schoolId = access ? assessmentSchoolId(access) : null;
  if (!access || !schoolId || !canAccessSchool(session!, schoolId)) {
    return tenantMiss();
  }
  const questions = await prisma.examQuestion.findMany({
    where: { assessmentId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = examQuestionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { subject: { select: { schoolId: true } }, module: { select: { course: { select: { schoolId: true } } } } },
  });
  if (!assessment) return tenantMiss();
  const schoolId =
    assessment.subject?.schoolId ??
    assessment.module?.course.schoolId ??
    null;
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return tenantMiss();
  }

  const teacher = session!.role === "TEACHER" ? await getTeacherForSession(session!) : null;
  if (teacher && assessment.teacherId && assessment.teacherId !== teacher.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const guard = await licenseWriteGuard({ schoolId, feature: "online_exams", action: "write" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  const count = await prisma.examQuestion.count({ where: { assessmentId: id } });
  const options = (parsed.data.options ?? []).map((opt) => opt.trim()).filter(Boolean);

  const question = await prisma.examQuestion.create({
    data: {
      assessmentId: id,
      prompt: parsed.data.prompt,
      type: parsed.data.type,
      options: options.length ? asInputJson(options) : undefined,
      correctAnswer: parsed.data.correctAnswer || null,
      points: parsed.data.points ?? 1,
      sortOrder: parsed.data.sortOrder ?? count,
    },
  });
  return NextResponse.json({ question }, { status: 201 });
}
