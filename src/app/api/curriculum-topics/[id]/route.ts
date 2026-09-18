import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { assertSchoolFks, scopedId } from "@/lib/tenant";
import { sessionHasPermission } from "@/lib/rbac";
import { curriculumTopicSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { emptyToNull } from "@/lib/class-teachers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    !sessionHasPermission(session, "classes:write") &&
    session.role !== UserRole.TEACHER
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.curriculumTopic.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = curriculumTopicSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const fkError = await assertSchoolFks(existing.schoolId, {
    classId: parsed.data.classId,
    termId: parsed.data.termId,
  });
  if (fkError) {
    return NextResponse.json({ message: fkError }, { status: 400 });
  }

  const topic = await prisma.curriculumTopic.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      ...(parsed.data.classId !== undefined ? { classId: emptyToNull(parsed.data.classId ?? undefined) } : {}),
      ...(parsed.data.termId !== undefined ? { termId: emptyToNull(parsed.data.termId ?? undefined) } : {}),
    },
  });

  return NextResponse.json({ topic });
}
