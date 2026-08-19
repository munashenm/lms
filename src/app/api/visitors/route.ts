import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { visitorSignInSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { asInputJson } from "@/lib/json";
import { emptyToNull } from "@/lib/class-teachers";
import { canViewVisitorBook, canWriteVisitorBook, toPublicVisitorEntry } from "@/lib/visitors";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !canViewVisitorBook(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolFilter = getSchoolFilter(session);
  const onSite = request.nextUrl.searchParams.get("onSite") === "1";
  const dateParam = request.nextUrl.searchParams.get("date");

  const where = {
    ...schoolFilter,
    ...(onSite ? { signedOutAt: null } : {}),
    ...(dateParam
      ? {
          signedInAt: {
            gte: new Date(`${dateParam}T00:00:00+02:00`),
            lt: new Date(`${dateParam}T23:59:59.999+02:00`),
          },
        }
      : {}),
  };

  const entries = await prisma.visitorEntry.findMany({
    where,
    include: {
      campus: { select: { name: true } },
      signedInBy: { select: { firstName: true, lastName: true } },
      signedOutBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ signedOutAt: "asc" }, { signedInAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ entries: entries.map(toPublicVisitorEntry) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId || !canWriteVisitorBook(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const denied = await requireLicenseWrite(session.schoolId, { feature: "visitor_management" });
  if (denied) return denied;

  const parsed = visitorSignInSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const campusId = emptyToNull(parsed.data.campusId ?? undefined) ?? null;
  if (campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: campusId, schoolId: session.schoolId },
      select: { id: true },
    });
    if (!campus) {
      return NextResponse.json({ message: "Campus not found" }, { status: 400 });
    }
  }

  const entry = await prisma.visitorEntry.create({
    data: {
      schoolId: session.schoolId,
      campusId,
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      organisation: emptyToNull(parsed.data.organisation ?? undefined) ?? null,
      phone: emptyToNull(parsed.data.phone ?? undefined) ?? null,
      identityType: parsed.data.identityType ?? null,
      identityNumber: emptyToNull(parsed.data.identityNumber ?? undefined) ?? null,
      hostKind: parsed.data.hostKind,
      hostName: parsed.data.hostName.trim(),
      purpose: parsed.data.purpose,
      purposeDetail: emptyToNull(parsed.data.purposeDetail ?? undefined) ?? null,
      vehicleRegistration: emptyToNull(parsed.data.vehicleRegistration ?? undefined) ?? null,
      badgeNumber: emptyToNull(parsed.data.badgeNumber ?? undefined) ?? null,
      notes: emptyToNull(parsed.data.notes ?? undefined) ?? null,
      signedInById: session.userId,
    },
    include: {
      campus: { select: { name: true } },
      signedInBy: { select: { firstName: true, lastName: true } },
      signedOutBy: { select: { firstName: true, lastName: true } },
    },
  });

  await logAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "VisitorEntry",
    entityId: entry.id,
    metadata: asInputJson({
      hostKind: entry.hostKind,
      purpose: entry.purpose,
    }),
  });

  return NextResponse.json({ entry: toPublicVisitorEntry(entry) }, { status: 201 });
}
