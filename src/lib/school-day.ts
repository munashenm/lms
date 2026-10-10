import { TIMEZONE } from "./constants";

/** Calendar date in Africa/Johannesburg, as YYYY-MM-DD. */
export function johannesburgDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC midnight of the Johannesburg calendar day. Attendance dates are stored this way. */
export function johannesburgDayStart(date = new Date()): Date {
  return new Date(`${johannesburgDateKey(date)}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
