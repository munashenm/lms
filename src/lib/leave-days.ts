/** Inclusive Monday–Friday count. Weekend-only ranges count as 1 day. */
export function countLeaveWorkingDays(start: Date, end: Date): number {
  const from = startOfLocalDay(start);
  const to = startOfLocalDay(end);
  if (to < from) return 0;

  let weekdays = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (weekdays > 0) return weekdays;
  return 1;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
