import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { classPatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { assignPrimaryClassTeacher, emptyToNull } from "@/lib/class-teachers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.class.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = classPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const cls = await prisma.class.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.gradeId !== undefined ? { gradeId: emptyToNull(data.gradeId) } : {}),
      ...(data.campusId !== undefined ? { campusId: emptyToNull(data.campusId) } : {}),
      ...(data.academicYearId !== undefined ? { academicYearId: emptyToNull(data.academicYearId) } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.room !== undefined ? { room: emptyToNull(data.room) } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: {
      grade: { select: { name: true } },
      campus: { select: { name: true } },
      classTeachers: {
        include: { teacher: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (data.teacherId !== undefined) {
    const assigned = await assignPrimaryClassTeacher({
      classId: id,
      schoolId: existing.schoolId,
      teacherId: emptyToNull(data.teacherId) ?? null,
    });
    if (!assigned.ok) {
      return NextResponse.json({ message: assigned.message }, { status: 400 });
    }
  }

  await logAudit({
    schoolId: existing.schoolId,
    userId: session.userId,
    action: "UPDATE",
    entity: "Class",
    entityId: id,
  });

  const updated = await prisma.class.findUnique({
    where: { id },
    include: {
      grade: { select: { name: true } },
      campus: { select: { name: true } },
      classTeachers: {
        include: { teacher: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  return NextResponse.json({ class: updated ?? cls });
}
