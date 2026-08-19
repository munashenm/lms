import { RecurringInterval } from "@prisma/client";

export function advanceRecurringDate(from: Date, interval: RecurringInterval): Date {
  const next = new Date(from.getTime());
  if (interval === RecurringInterval.YEARLY) next.setUTCFullYear(next.getUTCFullYear() + 1);
  else if (interval === RecurringInterval.QUARTERLY) next.setUTCMonth(next.getUTCMonth() + 3);
  else if (interval === RecurringInterval.HALF_YEARLY) next.setUTCMonth(next.getUTCMonth() + 6);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}
