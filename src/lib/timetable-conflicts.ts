import type { DayOfWeek } from "@prisma/client";

export interface TimetableSlotLike {
  id?: string;
  classId: string;
  teacherId?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  class?: { name: string };
  teacher?: { firstName: string; lastName: string } | null;
}

export interface TimetableConflict {
  type: "CLASS" | "TEACHER" | "ROOM";
  message: string;
  slotId?: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);
  return aStart < bEnd && bStart < aEnd;
}

export function findTimetableConflicts(
  existing: TimetableSlotLike[],
  candidate: TimetableSlotLike,
  excludeId?: string
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  for (const slot of existing) {
    if (excludeId && slot.id === excludeId) continue;
    if (slot.dayOfWeek !== candidate.dayOfWeek) continue;
    if (!timesOverlap(slot.startTime, slot.endTime, candidate.startTime, candidate.endTime)) continue;

    if (slot.classId === candidate.classId) {
      conflicts.push({
        type: "CLASS",
        message: `Class already has a slot at ${slot.startTime}–${slot.endTime}`,
        slotId: slot.id,
      });
    }

    if (candidate.teacherId && slot.teacherId === candidate.teacherId) {
      const name = slot.teacher
        ? `${slot.teacher.firstName} ${slot.teacher.lastName}`
        : "Teacher";
      conflicts.push({
        type: "TEACHER",
        message: `${name} is already scheduled at ${slot.startTime}–${slot.endTime}`,
        slotId: slot.id,
      });
    }

    if (candidate.room && slot.room && slot.room.toLowerCase() === candidate.room.toLowerCase()) {
      conflicts.push({
        type: "ROOM",
        message: `Room ${slot.room} is booked at ${slot.startTime}–${slot.endTime}`,
        slotId: slot.id,
      });
    }
  }

  return conflicts;
}

const SCHOOL_DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** Calendar day for timetable queries. Returns null on Sunday (no DayOfWeek enum value). */
export function getTodayDayOfWeek(date: Date = new Date()): DayOfWeek | null {
  const days: Array<DayOfWeek | null> = [
    null, // Sunday — not part of DayOfWeek
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return days[date.getDay()] ?? null;
}

/**
 * Full school week with today first, then the rest of the week wrapping around.
 * On Sunday (no school day), starts at Monday.
 */
export function orderDaysWithTodayFirst(today: DayOfWeek | null = getTodayDayOfWeek()): DayOfWeek[] {
  if (!today) return [...SCHOOL_DAYS];
  const index = SCHOOL_DAYS.indexOf(today);
  if (index <= 0) return [...SCHOOL_DAYS];
  return [...SCHOOL_DAYS.slice(index), ...SCHOOL_DAYS.slice(0, index)];
}
