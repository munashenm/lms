import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { licenseDeniedResponse, licenseWriteGuard } from "@/lib/licensing/enforce";
import { requireSchoolId } from "@/lib/portal-data";
import { classInSchool, scopedTimetableWhere } from "@/lib/tenant";
import { tenantMiss } from "@/lib/authorize";
import { findTimetableConflicts, type TimetableSlotLike } from "@/lib/timetable-conflicts";
import { proposeTimetable } from "@/lib/timetable-generate";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const guard = await licenseWriteGuard({ schoolId, feature: "timetable", action: "write" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  const body = await request.json().catch(() => ({}));
  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;
  const periodsPerWeek = Number(body.periodsPerWeek ?? 1);
  if (classId) {
    const klass = await classInSchool(classId, schoolId);
    if (!klass) return tenantMiss();
  }

  const [assignments, existing] = await Promise.all([
    prisma.classSubject.findMany({
      where: {
        class: { schoolId, isActive: true, ...(classId ? { id: classId } : {}) },
      },
      include: {
        class: { select: { id: true, name: true, room: true } },
        subject: { select: { id: true, name: true } },
      },
    }),
    prisma.timetableSlot.findMany({
      where: scopedTimetableWhere(session!),
      include: { teacher: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
    }),
  ]);

  if (assignments.length === 0) {
    return NextResponse.json({
      message: "Add subjects to a class before generating a timetable.",
      created: 0,
      unplaced: [],
    }, { status: 400 });
  }

  const occupied: TimetableSlotLike[] = existing.map((slot) => ({
    id: slot.id,
    classId: slot.classId,
    subjectId: slot.subjectId,
    teacherId: slot.teacherId,
    room: slot.room,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    class: slot.class,
    teacher: slot.teacher,
  }));

  const proposal = proposeTimetable({
    lessons: assignments.map((row) => ({
      classId: row.classId,
      subjectId: row.subjectId,
      teacherId: row.teacherId,
      room: row.class.room,
      periodsPerWeek: Number.isFinite(periodsPerWeek) ? periodsPerWeek : 1,
      className: row.class.name,
      subjectName: row.subject.name,
    })),
    existing: occupied,
  });

  const created = [];
  for (const slot of proposal.placed) {
    const clashes = findTimetableConflicts(occupied, slot);
    if (clashes.length > 0) continue;
    const row = await prisma.timetableSlot.create({
      data: {
        schoolId,
        classId: slot.classId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId || null,
        room: slot.room || null,
        dayOfWeek: slot.dayOfWeek as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY",
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
    occupied.push({ ...slot, id: row.id });
    created.push(row);
  }

  return NextResponse.json({
    created: created.length,
    unplaced: proposal.unplaced,
  });
}
