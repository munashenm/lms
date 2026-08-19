import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId, getTeacherForSession } from "@/lib/portal-data";
import { lessonPlanSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { emptyToNull } from "@/lib/class-teachers";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    !hasPermission(session.role, "classes:read") &&
    session.role !== UserRole.TEACHER
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const plans = await prisma.lessonPlan.findMany({
    where: {
      ...getSchoolFilter(session),
      ...(session.role === UserRole.TEACHER
        ? { teacher: { userId: session.userId } }
        : {}),
    },
    include: {
      subject: { select: { name: true, code: true } },
      class: { select: { name: true } },
      term: { select: { name: true } },
    },
    orderBy: { lessonDate: "desc" },
    take: 200,
  });
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    !hasPermission(session.role, "classes:write") &&
    session.role !== UserRole.TEACHER
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;

  const parsed = lessonPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  let teacherId: string | null = null;
  if (session.role === UserRole.TEACHER) {
    const teacher = await getTeacherForSession(session);
    teacherId = teacher?.id ?? null;
  } else {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, status: "ACTIVE" },
      select: { id: true },
    });
    teacherId = teacher?.id ?? null;
  }
  if (!teacherId) {
    return NextResponse.json({ message: "Teacher profile required" }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: { id: parsed.data.subjectId, schoolId },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ message: "Subject not found" }, { status: 404 });

  const plan = await prisma.lessonPlan.create({
    data: {
      schoolId,
      teacherId,
      subjectId: parsed.data.subjectId,
      classId: emptyToNull(parsed.data.classId ?? undefined),
      termId: emptyToNull(parsed.data.termId ?? undefined),
      weekNumber: parsed.data.weekNumber ?? null,
      title: parsed.data.title,
      topic: parsed.data.topic,
      objective: parsed.data.objective ?? null,
      resources: parsed.data.resources ?? null,
      readingMaterial: parsed.data.readingMaterial ?? null,
      relatedAssessmentId: emptyToNull(parsed.data.relatedAssessmentId ?? undefined),
      lessonDate: new Date(parsed.data.lessonDate),
      isPublished: parsed.data.isPublished ?? false,
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
