import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { campusPatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { emptyToNull } from "@/lib/class-teachers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.campus.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = campusPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.isMain === true) {
    await prisma.campus.updateMany({
      where: { schoolId: existing.schoolId, id: { not: id } },
      data: { isMain: false },
    });
  }

  try {
    const campus = await prisma.campus.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.address !== undefined ? { address: emptyToNull(data.address) } : {}),
        ...(data.isMain !== undefined ? { isMain: data.isMain } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Campus",
      entityId: id,
    });
    return NextResponse.json({ campus });
  } catch {
    return NextResponse.json({ message: "A campus with this code already exists" }, { status: 409 });
  }
}
