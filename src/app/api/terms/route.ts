import { NextRequest, NextResponse } from "next/server";
import { AcademicPeriodStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { termSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { parseDateInput, setCurrentTerm } from "@/lib/academic-session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const academicYearId = request.nextUrl.searchParams.get("academicYearId");
  const filter = getSchoolFilter(session);

  const terms = await prisma.term.findMany({
    where: {
      ...(academicYearId ? { academicYearId } : {}),
      academicYear: filter,
    },
    include: {
      academicYear: { select: { id: true, name: true, isCurrent: true } },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "asc" }],
  });

  return NextResponse.json({ terms });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = termSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const filter = getSchoolFilter(session!);
  const year = await prisma.academicYear.findFirst({
    where: { id: parsed.data.academicYearId, ...filter },
  });

  if (!year) {
    return NextResponse.json({ message: "Academic session not found" }, { status: 404 });
  }

  if (
    session!.role !== UserRole.SUPER_ADMIN &&
    session!.schoolId &&
    year.schoolId !== session!.schoolId
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const startDate = parseDateInput(parsed.data.startDate);
  const endDate = parseDateInput(parsed.data.endDate);
  if (!startDate || !endDate || endDate <= startDate) {
    return NextResponse.json(
      { message: "End date must be after start date" },
      { status: 400 }
    );
  }

  let term;
  try {
    term = await prisma.term.create({
      data: {
        academicYearId: year.id,
        name: parsed.data.name,
        termNumber: parsed.data.termNumber,
        startDate,
        endDate,
        status:
          (parsed.data.status as AcademicPeriodStatus | undefined) ??
          AcademicPeriodStatus.PLANNED,
        isCurrent: false,
        resultsPublishingDate: parseDateInput(parsed.data.resultsPublishingDate),
        attendanceStartDate: parseDateInput(parsed.data.attendanceStartDate) ?? startDate,
        attendanceEndDate: parseDateInput(parsed.data.attendanceEndDate) ?? endDate,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "A period with this number already exists in the session" },
      { status: 409 }
    );
  }

  if (parsed.data.setCurrent || parsed.data.status === "ACTIVE") {
    term = await setCurrentTerm(term.id);
  }

  await logAudit({
    schoolId: year.schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Term",
    entityId: term.id,
    metadata: { name: term.name, academicYearId: year.id },
  });

  return NextResponse.json({ term }, { status: 201 });
}
