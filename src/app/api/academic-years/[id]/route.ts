import { NextRequest, NextResponse } from "next/server";
import { AcademicSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { academicYearUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  parseDateInput,
  setCurrentAcademicSession,
} from "@/lib/academic-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedYear(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const filter = getSchoolFilter(session);
  return prisma.academicYear.findFirst({
    where: { id, ...filter },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const year = await getOwnedYear(id, session);
  if (!year) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ academicYear: year });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedYear(id, session!);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = academicYearUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const action = parsed.data.action;
  let year = existing;

  if (action === "activate" || action === "set_current") {
    await setCurrentAcademicSession(existing.schoolId, existing.id);
    year = await prisma.academicYear.findUniqueOrThrow({
      where: { id: existing.id },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  } else if (action === "close") {
    year = await prisma.academicYear.update({
      where: { id },
      data: {
        status: AcademicSessionStatus.CLOSED,
        isCurrent: false,
        closedAt: new Date(),
      },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  } else if (action === "archive") {
    year = await prisma.academicYear.update({
      where: { id },
      data: {
        status: AcademicSessionStatus.ARCHIVED,
        isCurrent: false,
        archivedAt: new Date(),
        closedAt: existing.closedAt ?? new Date(),
      },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  } else if (action === "reopen") {
    year = await prisma.academicYear.update({
      where: { id },
      data: {
        status: AcademicSessionStatus.PLANNED,
        isCurrent: false,
        closedAt: null,
        archivedAt: null,
      },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    });
  } else {
    const startDate = parsed.data.startDate
      ? parseDateInput(parsed.data.startDate)
      : existing.startDate;
    const endDate = parsed.data.endDate
      ? parseDateInput(parsed.data.endDate)
      : existing.endDate;

    if (!startDate || !endDate || endDate <= startDate) {
      return NextResponse.json(
        { message: "End date must be after start date" },
        { status: 400 }
      );
    }

    try {
      year = await prisma.academicYear.update({
        where: { id },
        data: {
          name: parsed.data.name ?? existing.name,
          startDate,
          endDate,
          ...(parsed.data.status
            ? { status: parsed.data.status as AcademicSessionStatus }
            : {}),
        },
        include: { terms: { orderBy: { termNumber: "asc" } } },
      });
    } catch {
      return NextResponse.json(
        { message: "A session with this name already exists" },
        { status: 409 }
      );
    }

    if (parsed.data.status === "ACTIVE") {
      await setCurrentAcademicSession(existing.schoolId, id);
      year = await prisma.academicYear.findUniqueOrThrow({
        where: { id },
        include: { terms: { orderBy: { termNumber: "asc" } } },
      });
    }
  }

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "AcademicYear",
    entityId: year.id,
    metadata: { action: action ?? "update", status: year.status, name: year.name },
  });

  return NextResponse.json({ academicYear: year });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedYear(id, session!);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (existing.isCurrent || existing.status === AcademicSessionStatus.ACTIVE) {
    return NextResponse.json(
      { message: "Close or archive the active session before removing it" },
      { status: 400 }
    );
  }

  const [enrolments, classes, reportCards] = await Promise.all([
    prisma.enrolment.count({ where: { academicYearId: id } }),
    prisma.class.count({ where: { academicYearId: id } }),
    prisma.reportCard.count({ where: { academicYearId: id } }),
  ]);

  if (enrolments + classes + reportCards > 0) {
    const archived = await prisma.academicYear.update({
      where: { id },
      data: {
        status: AcademicSessionStatus.ARCHIVED,
        isCurrent: false,
        archivedAt: new Date(),
      },
    });

    await logAudit({
      schoolId: existing.schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "AcademicYear",
      entityId: id,
      metadata: { action: "archive_instead_of_delete" },
    });

    return NextResponse.json({
      academicYear: archived,
      message: "Session archived to preserve historical records",
    });
  }

  await prisma.academicYear.delete({ where: { id } });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "DELETE",
    entity: "AcademicYear",
    entityId: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
