import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { schoolSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const filter = getSchoolFilter(session!);
  if (!("schoolId" in filter)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ schools });
  }

  const school = await prisma.school.findUnique({
    where: { id: filter.schoolId },
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

  const filter = getSchoolFilter(session!);
  if (!("schoolId" in filter)) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schoolSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const school = await prisma.school.update({
    where: { id: filter.schoolId },
    data: parsed.data,
  });

  await logAudit({
    schoolId: filter.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "School",
    entityId: school.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ school });
}
