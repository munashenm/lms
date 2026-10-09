import { SCHEDULED_JOBS, nextDailyRunAt, sanitizeSchedulerError, type ScheduledJobKey } from "./catalog";
import { releaseJobLease, tryAcquireJobLease } from "./lock";
import { runDueLicenseHeartbeats } from "@/lib/licensing/run-heartbeat";

async function executeJob(key: ScheduledJobKey): Promise<void> {
  if (key === "license-heartbeat") {
    const result = await runDueLicenseHeartbeats();
    if (result.failed > 0) {
      throw new Error(`Licence heartbeat recorded ${result.failed} failed check(s)`);
    }
    return;
  }
  throw new Error(`Job ${key} is not enabled for automatic execution`);
}

/**
 * Runs one automatic job when this process can take the database lease.
 * Failures are logged and the lease is released. They do not escape to the caller.
 */
export async function runScheduledJob(key: ScheduledJobKey, reason: "startup" | "daily"): Promise<void> {
  const definition = SCHEDULED_JOBS.find((job) => job.key === key);
  if (!definition?.automatic) return;

  let lease: Awaited<ReturnType<typeof tryAcquireJobLease>> = null;
  try {
    lease = await tryAcquireJobLease(key);
    if (!lease) {
      console.info("[scheduler]", JSON.stringify({ job: key, reason, outcome: "locked" }));
      return;
    }
    await executeJob(key);
    await releaseJobLease(lease, { ok: true, nextRunAt: nextDailyRunAt() });
    console.info("[scheduler]", JSON.stringify({ job: key, reason, outcome: "ok" }));
  } catch (error) {
    const message = sanitizeSchedulerError(error);
    console.error("[scheduler]", JSON.stringify({ job: key, reason, outcome: "failed", error: message }));
    if (lease) {
      try {
        await releaseJobLease(lease, { ok: false, error: message, nextRunAt: nextDailyRunAt() });
      } catch (releaseError) {
        console.error(
          "[scheduler]",
          JSON.stringify({ job: key, reason, outcome: "release-failed", error: sanitizeSchedulerError(releaseError) })
        );
      }
    }
  }
}

export function startInProcessScheduler() {
  const globalState = globalThis as { __schoolhubSchedulerStarted?: boolean };
  if (globalState.__schoolhubSchedulerStarted) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV === "test") return;
  globalState.__schoolhubSchedulerStarted = true;

  const runDue = (reason: "startup" | "daily") => {
    for (const job of SCHEDULED_JOBS) {
      if (!job.automatic) continue;
      void runScheduledJob(job.key, reason);
    }
  };

  const armDaily = () => {
    const delay = Math.max(1_000, nextDailyRunAt().getTime() - Date.now());
    setTimeout(() => {
      runDue("daily");
      armDaily();
    }, delay);
  };

  setTimeout(() => runDue("startup"), 0);
  armDaily();
}
