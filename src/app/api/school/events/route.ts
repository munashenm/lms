import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter, hasPermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { schoolEventSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasPermission(session.role, "announcements:write") &&
    !hasPermission(session.role, "settings:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const filter = getSchoolFilter(session!);
  const events = await prisma.schoolEvent.findMany({
    where: "schoolId" in filter ? { schoolId: filter.schoolId } : {},
    orderBy: { startsAt: "asc" },
    take: 80,
  });
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const parsed = schoolEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;

  const event = await prisma.schoolEvent.create({
    data: {
      schoolId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isPublic: parsed.data.isPublic ?? true,
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}
