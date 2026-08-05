import { NextRequest, NextResponse } from "next/server";
import { AcademicPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { termUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { parseDateInput, setCurrentTerm } from "@/lib/academic-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedTerm(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const filter = getSchoolFilter(session);
  return prisma.term.findFirst({
    where: { id, academicYear: filter },
    include: { academicYear: true },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedTerm(id, session!);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = termUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const action = parsed.data.action;
  let term = existing;

  if (action === "activate" || action === "set_current") {
    await setCurrentTerm(id);
    term = await prisma.term.findUniqueOrThrow({
      where: { id },
      include: { academicYear: true },
    });
  } else if (action === "close") {
    term = await prisma.term.update({
      where: { id },
      data: {
        status: AcademicPeriodStatus.CLOSED,
        isCurrent: false,
      },
      include: { academicYear: true },
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
      term = await prisma.term.update({
        where: { id },
        data: {
          name: parsed.data.name ?? existing.name,
          termNumber: parsed.data.termNumber ?? existing.termNumber,
          startDate,
          endDate,
          ...(parsed.data.status
            ? { status: parsed.data.status as AcademicPeriodStatus }
            : {}),
          resultsPublishingDate:
            parsed.data.resultsPublishingDate !== undefined
              ? parseDateInput(parsed.data.resultsPublishingDate)
              : existing.resultsPublishingDate,
          attendanceStartDate:
            parsed.data.attendanceStartDate !== undefined
              ? parseDateInput(parsed.data.attendanceStartDate)
              : existing.attendanceStartDate,
          attendanceEndDate:
            parsed.data.attendanceEndDate !== undefined
              ? parseDateInput(parsed.data.attendanceEndDate)
              : existing.attendanceEndDate,
        },
        include: { academicYear: true },
      });
    } catch {
      return NextResponse.json(
        { message: "A period with this number already exists in the session" },
        { status: 409 }
      );
    }

    if (parsed.data.setCurrent || parsed.data.status === "ACTIVE") {
      await setCurrentTerm(id);
      term = await prisma.term.findUniqueOrThrow({
        where: { id },
        include: { academicYear: true },
      });
    }
  }

  await logAudit({
    schoolId: existing.academicYear.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "Term",
    entityId: term.id,
    metadata: { action: action ?? "update", name: term.name },
  });

  return NextResponse.json({ term });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedTerm(id, session!);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [assessments, attendance, reportCards] = await Promise.all([
    prisma.assessment.count({ where: { termId: id } }),
    prisma.attendanceRecord.count({ where: { termId: id } }),
    prisma.reportCard.count({ where: { termId: id } }),
  ]);

  if (assessments + attendance + reportCards > 0) {
    return NextResponse.json(
      { message: "Cannot delete a period that has linked academic records. Close it instead." },
      { status: 400 }
    );
  }

  await prisma.term.delete({ where: { id } });

  await logAudit({
    schoolId: existing.academicYear.schoolId,
    userId: session!.userId,
    action: "DELETE",
    entity: "Term",
    entityId: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
