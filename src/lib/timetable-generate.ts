import type { DayOfWeek } from "@prisma/client";
import { findTimetableConflicts, type TimetableSlotLike } from "./timetable-conflicts";

export interface SchoolPeriod {
  startTime: string;
  endTime: string;
}

/** A standard six-period day. Breaks are the gaps between periods. */
export const SCHOOL_PERIODS: SchoolPeriod[] = [
  { startTime: "07:30", endTime: "08:15" },
  { startTime: "08:15", endTime: "09:00" },
  { startTime: "09:15", endTime: "10:00" },
  { startTime: "10:00", endTime: "10:45" },
  { startTime: "11:00", endTime: "11:45" },
  { startTime: "11:45", endTime: "12:30" },
];

const WEEKDAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export interface TimetableLesson {
  classId: string;
  subjectId: string;
  teacherId?: string | null;
  room?: string | null;
  periodsPerWeek?: number;
  className?: string;
  subjectName?: string;
}

export interface ProposedTimetableSlot extends TimetableSlotLike {
  subjectId: string;
}

export interface UnplacedLesson {
  classId: string;
  subjectId: string;
  subjectName?: string;
  className?: string;
  reason: string;
}

export function proposeTimetable(params: {
  lessons: TimetableLesson[];
  existing?: TimetableSlotLike[];
  periods?: SchoolPeriod[];
  days?: DayOfWeek[];
}): { placed: ProposedTimetableSlot[]; unplaced: UnplacedLesson[] } {
  const periods = params.periods ?? SCHOOL_PERIODS;
  const days = params.days ?? WEEKDAYS;
  const placed: ProposedTimetableSlot[] = [];
  const unplaced: UnplacedLesson[] = [];
  const occupied: TimetableSlotLike[] = [...(params.existing ?? [])];

  const lessons = [...params.lessons].sort((a, b) => {
    const teacherA = a.teacherId ? 0 : 1;
    const teacherB = b.teacherId ? 0 : 1;
    return teacherA - teacherB;
  });

  for (const lesson of lessons) {
    const wanted = Math.min(5, Math.max(1, Math.floor(lesson.periodsPerWeek ?? 1)));
    const already = occupied.filter(
      (slot) => slot.classId === lesson.classId && slot.subjectId === lesson.subjectId
    ).length;
    const remaining = wanted - already;
    if (remaining <= 0) continue;
    const usedDays = new Set(
      occupied
        .filter((slot) => slot.classId === lesson.classId && slot.subjectId === lesson.subjectId)
        .map((slot) => slot.dayOfWeek)
    );
    let added = 0;
    for (let n = 0; n < remaining; n += 1) {
      const slot = firstFreePeriod({ lesson, periods, days, occupied, preferFreshDay: usedDays });
      if (!slot) break;
      placed.push(slot);
      occupied.push(slot);
      usedDays.add(slot.dayOfWeek);
      added += 1;
    }
    if (added < remaining) {
      unplaced.push({
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName,
        className: lesson.className,
        reason: already + added === 0
          ? "No free period without a class, teacher, or room clash"
          : `Placed ${already + added} of ${wanted} periods`,
      });
    }
  }

  return { placed, unplaced };
}

function firstFreePeriod(params: {
  lesson: TimetableLesson;
  periods: SchoolPeriod[];
  days: DayOfWeek[];
  occupied: TimetableSlotLike[];
  preferFreshDay: Set<string>;
}): ProposedTimetableSlot | null {
  const orderedDays = [
    ...params.days.filter((day) => !params.preferFreshDay.has(day)),
    ...params.days.filter((day) => params.preferFreshDay.has(day)),
  ];
  for (const dayOfWeek of orderedDays) {
    for (const period of params.periods) {
      const candidate: ProposedTimetableSlot = {
        classId: params.lesson.classId,
        subjectId: params.lesson.subjectId,
        teacherId: params.lesson.teacherId ?? null,
        room: params.lesson.room ?? null,
        dayOfWeek,
        startTime: period.startTime,
        endTime: period.endTime,
        class: params.lesson.className ? { name: params.lesson.className } : undefined,
      };
      if (findTimetableConflicts(params.occupied, candidate).length === 0) return candidate;
    }
  }
  return null;
}
