/**
 * One catalog for every /api/cron job.
 * Only jobs marked automatic are started by the web process.
 * The others stay on their protected HTTP routes until reviewed.
 */

export const DAILY_RUN_HOUR_UTC = 15;
export const DAILY_RUN_MINUTE_UTC = 0;

export type ScheduledJobKey =
  | "license-heartbeat"
  | "backups"
  | "fee-reminders"
  | "import-cleanup"
  | "leave-accrual"
  | "recurring-expenses";

export interface ScheduledJobDefinition {
  key: ScheduledJobKey;
  name: string;
  route: string;
  intendedSchedule: string;
  automatic: boolean;
  holdReason: string | null;
}

export const SCHEDULED_JOBS: ScheduledJobDefinition[] = [
  {
    key: "license-heartbeat",
    name: "Licence heartbeat",
    route: "/api/cron/license-heartbeat",
    intendedSchedule: "Daily at 15:00 UTC, plus a startup catch-up when a licence is already due",
    automatic: true,
    holdReason: null,
  },
  {
    key: "backups",
    name: "Backups",
    route: "/api/cron/backups",
    intendedSchedule: "Hourly check of due backup schedules",
    automatic: false,
    holdReason: "Creates backup objects and can delete older scheduled backups. Held until reviewed.",
  },
  {
    key: "fee-reminders",
    name: "Fee reminders",
    route: "/api/cron/fee-reminders",
    intendedSchedule: "Daily",
    automatic: false,
    holdReason: "Can email or SMS parents about outstanding fees. Held until reviewed.",
  },
  {
    key: "import-cleanup",
    name: "Import cleanup",
    route: "/api/cron/import-cleanup",
    intendedSchedule: "Daily",
    automatic: false,
    holdReason: "Deletes expired SA-SAMS staging files. Held until reviewed.",
  },
  {
    key: "leave-accrual",
    name: "Leave accrual",
    route: "/api/cron/leave-accrual",
    intendedSchedule: "Monthly",
    automatic: false,
    holdReason: "Updates staff leave balances. Held until reviewed.",
  },
  {
    key: "recurring-expenses",
    name: "Recurring expenses",
    route: "/api/cron/recurring-expenses",
    intendedSchedule: "Daily",
    automatic: false,
    holdReason: "Creates finance expense rows. Held until reviewed.",
  },
];

export function scheduledJob(key: string): ScheduledJobDefinition | undefined {
  return SCHEDULED_JOBS.find((job) => job.key === key);
}

/** Next 15:00 UTC strictly after `from`, or that moment when it is still ahead. */
export function nextDailyRunAt(from = new Date(), hourUtc = DAILY_RUN_HOUR_UTC, minuteUtc = DAILY_RUN_MINUTE_UTC): Date {
  const next = new Date(from);
  next.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function sanitizeSchedulerError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Scheduled job failed";
  return message
    .replace(/SG\.[A-Za-z0-9._-]{8,}/g, "[redacted]")
    .replace(/re_[A-Za-z0-9_]{8,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/SHSA-[A-Z0-9-]{4,}/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
