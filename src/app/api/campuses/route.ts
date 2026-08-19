import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { campusSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const campuses = await prisma.campus.findMany({
    where: { ...getSchoolFilter(session), isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ campuses });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = campusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);
  const restricted = await requireLicenseWrite(schoolId);
  if (restricted) return restricted;

  const guard = await licenseWriteGuard({ schoolId, action: "create_campus" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  try {
    const campus = await prisma.campus.create({
      data: {
        schoolId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        address: parsed.data.address || null,
        isMain: parsed.data.isMain ?? false,
      },
    });

    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "CREATE",
      entity: "Campus",
      entityId: campus.id,
      metadata: { code: campus.code },
    });

    return NextResponse.json({ campus }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "A campus with this code already exists" }, { status: 409 });
  }
}
