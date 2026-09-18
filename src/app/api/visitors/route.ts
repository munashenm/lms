import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { visitorSignInSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { asInputJson } from "@/lib/json";
import { emptyToNull } from "@/lib/class-teachers";
import { canViewVisitorBook, canWriteVisitorBook, toPublicVisitorEntry } from "@/lib/visitors";
import { csvDownloadHeaders, excelDownloadHeaders, toCsv, toExcelCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !canViewVisitorBook(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolFilter = getSchoolFilter(session);
  const onSite = request.nextUrl.searchParams.get("onSite") === "1";
  const dateParam = request.nextUrl.searchParams.get("date");
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status");
  const format = request.nextUrl.searchParams.get("format");
  const allowedStatus = ["EXPECTED", "CHECKED_IN", "CHECKED_OUT", "DENIED", "OVERDUE"] as const;
  const statusFilter = allowedStatus.includes(status as (typeof allowedStatus)[number])
    ? (status as (typeof allowedStatus)[number])
    : undefined;

  const where: Prisma.VisitorEntryWhereInput = {
    ...schoolFilter,
    ...(onSite ? { signedOutAt: null, status: { in: ["CHECKED_IN", "OVERDUE"] } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateParam
      ? {
          OR: [
            {
              signedInAt: {
                gte: new Date(`${dateParam}T00:00:00+02:00`),
                lte: new Date(`${dateParam}T23:59:59.999+02:00`),
              },
            },
            {
              expectedAt: {
                gte: new Date(`${dateParam}T00:00:00+02:00`),
                lte: new Date(`${dateParam}T23:59:59.999+02:00`),
              },
            },
          ],
        }
      : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { badgeNumber: { contains: q, mode: "insensitive" } },
                { hostName: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
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
    take: format ? 2000 : 200,
  });

  const publicRows = entries.map(toPublicVisitorEntry);
  if (format === "csv" || format === "xlsx") {
    const headers = ["Date", "Visitor", "Phone", "Host", "Department", "Purpose", "Status", "Badge"];
    const rows = publicRows.map((row) => [
      row.signedInAt.toISOString(),
      `${row.firstName} ${row.lastName}`,
      row.phone ?? "",
      row.hostName,
      row.department ?? "",
      row.purpose,
      row.status ?? "",
      row.badgeNumber ?? "",
    ]);
    if (format === "xlsx") {
      return new NextResponse(toExcelCsv(headers, rows), { headers: excelDownloadHeaders("visitors.xls") });
    }
    return new NextResponse(toCsv(headers, rows), { headers: csvDownloadHeaders("visitors.csv") });
  }

  return NextResponse.json({ entries: publicRows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId || !canWriteVisitorBook(session)) {
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
      email: emptyToNull(parsed.data.email ?? undefined) ?? null,
      department: emptyToNull(parsed.data.department ?? undefined) ?? null,
      itemsBrought: emptyToNull(parsed.data.itemsBrought ?? undefined) ?? null,
      expectedAt: parsed.data.expectedAt ? new Date(parsed.data.expectedAt) : null,
      expectedDepartureAt: parsed.data.expectedDepartureAt ? new Date(parsed.data.expectedDepartureAt) : null,
      status: parsed.data.preregister ? "EXPECTED" : "CHECKED_IN",
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
