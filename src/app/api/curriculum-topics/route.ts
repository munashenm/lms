import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { curriculumTopicSchema } from "@/lib/validators";
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

  const topics = await prisma.curriculumTopic.findMany({
    where: getSchoolFilter(session),
    include: {
      subject: { select: { name: true, code: true } },
      class: { select: { name: true } },
      term: { select: { name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return NextResponse.json({ topics });
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

  const parsed = curriculumTopicSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const subject = await prisma.subject.findFirst({
    where: { id: parsed.data.subjectId, schoolId },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ message: "Subject not found" }, { status: 404 });

  const topic = await prisma.curriculumTopic.create({
    data: {
      schoolId,
      subjectId: parsed.data.subjectId,
      classId: emptyToNull(parsed.data.classId ?? undefined),
      termId: emptyToNull(parsed.data.termId ?? undefined),
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      status: parsed.data.status ?? "PLANNED",
    },
  });
  return NextResponse.json({ topic }, { status: 201 });
}
