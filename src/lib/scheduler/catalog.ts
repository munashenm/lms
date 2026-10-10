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
  /** daily jobs use 15:00 UTC. hourly jobs are checked every hour, including startup. */
  cadence: "daily" | "hourly";
  automatic: boolean;
  /** How long a run may hold the single-flight lease. */
  leaseMs: number;
  holdReason: string | null;
}

export const SCHEDULED_JOBS: ScheduledJobDefinition[] = [
  {
    key: "license-heartbeat",
    name: "Licence heartbeat",
    route: "/api/cron/license-heartbeat",
    intendedSchedule: "Daily at 15:00 UTC, plus a startup catch-up when a licence is already due",
    cadence: "daily",
    automatic: true,
    leaseMs: 10 * 60 * 1000,
    holdReason: null,
  },
  {
    key: "backups",
    name: "Backups",
    route: "/api/cron/backups",
    intendedSchedule: "Hourly check of due backup schedules, plus a startup catch-up",
    cadence: "hourly",
    automatic: true,
    leaseMs: 2 * 60 * 60 * 1000,
    holdReason: null,
  },
  {
    key: "fee-reminders",
    name: "Fee reminders",
    route: "/api/cron/fee-reminders",
    intendedSchedule: "Daily at 15:00 UTC, plus a startup catch-up. Only enabled rules send.",
    cadence: "daily",
    automatic: true,
    leaseMs: 30 * 60 * 1000,
    holdReason: null,
  },
  {
    key: "import-cleanup",
    name: "Import cleanup",
    route: "/api/cron/import-cleanup",
    intendedSchedule: "Daily",
    cadence: "daily",
    automatic: false,
    leaseMs: 10 * 60 * 1000,
    holdReason: "Deletes expired staging files for finished SA-SAMS imports only. Held until a school reviews open imports.",
  },
  {
    key: "leave-accrual",
    name: "Leave accrual",
    route: "/api/cron/leave-accrual",
    intendedSchedule: "Monthly",
    cadence: "daily",
    automatic: false,
    leaseMs: 10 * 60 * 1000,
    holdReason: "Recalculates staff leave accrual for the calendar year. Held until one school is compared first.",
  },
  {
    key: "recurring-expenses",
    name: "Recurring expenses",
    route: "/api/cron/recurring-expenses",
    intendedSchedule: "Daily",
    cadence: "daily",
    automatic: false,
    leaseMs: 10 * 60 * 1000,
    holdReason: "Creates finance expense rows. Held until one school’s due dates are reviewed.",
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
