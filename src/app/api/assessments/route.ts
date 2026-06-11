import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getTeacherForSession } from "@/lib/portal-data";
import { assessmentSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");
  const publishedOnly = searchParams.get("published") === "true";

  const teacher = session!.role === "TEACHER" ? await getTeacherForSession(session!) : null;

  const assessments = await prisma.assessment.findMany({
    where: {
      ...(subjectId && { subjectId }),
      ...(publishedOnly && { isPublished: true }),
      ...(teacher && { teacherId: teacher.id }),
      OR: [
        { subject: getSchoolFilter(session!) },
        { module: { course: getSchoolFilter(session!) } },
      ],
    },
    include: {
      subject: { select: { name: true, code: true } },
      module: { select: { name: true, code: true } },
      term: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      assignment: true,
      _count: { select: { marks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assessments });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = assessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const teacher = await getTeacherForSession(session!);
  const data = parsed.data;

  const assessment = await prisma.assessment.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: data.type,
      subjectId: data.subjectId || null,
      moduleId: data.moduleId || null,
      termId: data.termId || null,
      teacherId: teacher?.id ?? null,
      maxMarks: data.maxMarks,
      weight: data.weight ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isPublished: false,
      ...(data.isAssignment || data.type === "ASSIGNMENT"
        ? {
            assignment: {
              create: {
                instructions: data.instructions || data.description || null,
              },
            },
          }
        : {}),
    },
    include: { assignment: true, subject: true },
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
