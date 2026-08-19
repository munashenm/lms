import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { schoolSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = resolveSettingsSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ schools });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { campuses: { where: { isActive: true }, orderBy: { name: "asc" } } },
  });

  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const schoolId = resolveSettingsSchoolId(
    session!,
    body.schoolId ?? request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;

  const parsed = schoolSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    ...(parsed.data.logoUrl !== undefined && {
      logoUrl: parsed.data.logoUrl || null,
    }),
    ...(parsed.data.website !== undefined && {
      website: parsed.data.website || null,
    }),
    ...(parsed.data.email !== undefined && {
      email: parsed.data.email || null,
    }),
  };

  const school = await prisma.school.update({
    where: { id: schoolId },
    data,
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "School",
    entityId: school.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ school });
}
