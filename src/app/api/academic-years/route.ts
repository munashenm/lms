import { NextRequest, NextResponse } from "next/server";
import {
  AcademicPeriodStatus,
  AcademicSessionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { academicYearSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  defaultPeriodNames,
  defaultPeriodStructure,
} from "@/lib/terminology";
import {
  parseDateInput,
  setCurrentAcademicSession,
} from "@/lib/academic-session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const filter = getSchoolFilter(session);
  const years = await prisma.academicYear.findMany({
    where: filter,
    include: {
      terms: { orderBy: { termNumber: "asc" } },
      _count: { select: { enrolments: true, classes: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ academicYears: years });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = academicYearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);

  const startDate = parseDateInput(parsed.data.startDate);
  const endDate = parseDateInput(parsed.data.endDate);
  if (!startDate || !endDate || endDate <= startDate) {
    return NextResponse.json(
      { message: "End date must be after start date" },
      { status: 400 }
    );
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  const makeActive = parsed.data.status === "ACTIVE";
  const createDefaults = parsed.data.createDefaultPeriods !== false;

  const periodStructure =
    school.periodStructure ?? defaultPeriodStructure(school.institutionType);

  let year;
  try {
    year = await prisma.academicYear.create({
      data: {
        schoolId,
        name: parsed.data.name,
        startDate,
        endDate,
        status: makeActive
          ? AcademicSessionStatus.ACTIVE
          : (parsed.data.status as AcademicSessionStatus | undefined) ??
            AcademicSessionStatus.PLANNED,
        isCurrent: false,
        terms: createDefaults
          ? {
              create: defaultPeriodNames(periodStructure).map((p, index) => ({
                name: p.name,
                termNumber: p.termNumber,
                startDate,
                endDate,
                status:
                  index === 0 && makeActive
                    ? AcademicPeriodStatus.ACTIVE
                    : AcademicPeriodStatus.PLANNED,
                isCurrent: index === 0 && makeActive,
              })),
            }
          : undefined,
      },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  } catch {
    return NextResponse.json(
      { message: "A session with this name already exists" },
      { status: 409 }
    );
  }

  if (makeActive) {
    const yearId = year.id;
    await setCurrentAcademicSession(schoolId, yearId);
    year = await prisma.academicYear.findUniqueOrThrow({
      where: { id: yearId },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  }

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "AcademicYear",
    entityId: year.id,
    metadata: { name: year.name, status: year.status },
  });

  return NextResponse.json({ academicYear: year }, { status: 201 });
}
