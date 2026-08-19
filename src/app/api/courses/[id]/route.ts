import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { coursePatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { emptyToNull } from "@/lib/class-teachers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = coursePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: emptyToNull(data.description) } : {}),
        ...(data.nqfLevel !== undefined ? { nqfLevel: data.nqfLevel } : {}),
        ...(data.durationMonths !== undefined ? { durationMonths: data.durationMonths } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Course",
      entityId: id,
    });
    return NextResponse.json({ course });
  } catch {
    return NextResponse.json({ message: "A course with this code already exists" }, { status: 409 });
  }
}
