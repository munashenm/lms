import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { findTimetableConflicts } from "@/lib/timetable-conflicts";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");

  const slots = await prisma.timetableSlot.findMany({
    where: classId ? { classId } : { class: getSchoolFilter(session!) },
    include: {
      class: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  const allConflicts: { slotId: string; conflicts: ReturnType<typeof findTimetableConflicts> }[] = [];

  for (const slot of slots) {
    const others = slots.filter((s) => s.id !== slot.id);
    const conflicts = findTimetableConflicts(others, slot);
    if (conflicts.length > 0) {
      allConflicts.push({ slotId: slot.id, conflicts });
    }
  }

  const unique = allConflicts.filter(
    (item, idx, arr) => arr.findIndex((x) => x.slotId === item.slotId) === idx
  );

  return NextResponse.json({ conflicts: unique, total: unique.length });
}
