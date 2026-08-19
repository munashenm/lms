import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { subjectPatchSchema } from "@/lib/validators";
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
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = subjectPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.gradeId !== undefined ? { gradeId: emptyToNull(data.gradeId) } : {}),
        ...(data.description !== undefined ? { description: emptyToNull(data.description) } : {}),
        ...(data.credits !== undefined ? { credits: data.credits } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Subject",
      entityId: id,
    });
    return NextResponse.json({ subject });
  } catch {
    return NextResponse.json({ message: "A subject with this code already exists" }, { status: 409 });
  }
}
