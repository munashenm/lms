import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { timetableSlotSchema } from "@/lib/validators";
import { findTimetableConflicts } from "@/lib/timetable-conflicts";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const teacherId = searchParams.get("teacherId");

  const slots = await prisma.timetableSlot.findMany({
    where: {
      ...(classId && { classId }),
      ...(teacherId && { teacherId }),
      ...(!classId && !teacherId
        ? { class: getSchoolFilter(session) }
        : {}),
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      module: { select: { name: true, code: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ slots });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = timetableSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const existing = await prisma.timetableSlot.findMany({
    where: { class: getSchoolFilter(session!) },
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const conflicts = findTimetableConflicts(existing, {
    classId: parsed.data.classId,
    teacherId: parsed.data.teacherId ?? null,
    dayOfWeek: parsed.data.dayOfWeek,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    room: parsed.data.room ?? null,
  });

  if (conflicts.length > 0) {
    return NextResponse.json(
      { message: "Timetable conflict detected", conflicts },
      { status: 409 }
    );
  }

  const slot = await prisma.timetableSlot.create({
    data: {
      classId: parsed.data.classId,
      subjectId: parsed.data.subjectId || null,
      moduleId: parsed.data.moduleId || null,
      teacherId: parsed.data.teacherId || null,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      room: parsed.data.room || null,
    },
    include: {
      subject: true,
      module: true,
      teacher: true,
    },
  });

  return NextResponse.json({ slot }, { status: 201 });
}
