import { prisma } from "@/lib/db";
import { SCHEDULED_JOBS, nextDailyRunAt } from "./catalog";

export async function listScheduledJobStatus() {
  const rows = await prisma.schedulerJobState.findMany();
  const byKey = new Map(rows.map((row) => [row.jobKey, row]));
  return SCHEDULED_JOBS.map((job) => {
    const state = byKey.get(job.key);
    const status = !job.automatic ? "held" : state?.lastFailureAt && (!state.lastSuccessAt || state.lastFailureAt > state.lastSuccessAt) ? "failed" : state?.lastSuccessAt ? "ok" : "pending";
    return {
      job: job.key,
      name: job.name,
      route: job.route,
      intendedSchedule: job.intendedSchedule,
      automatic: job.automatic,
      holdReason: job.holdReason,
      status,
      lastSuccessfulRun: state?.lastSuccessAt ?? null,
      lastFailure: state?.lastFailureAt ?? null,
      lastError: state?.lastError ?? null,
      nextRun: !job.automatic
        ? null
        : (state?.nextRunAt ?? (job.cadence === "hourly" ? new Date(Date.now() + 60 * 60 * 1000) : nextDailyRunAt())),
    };
  });
}
