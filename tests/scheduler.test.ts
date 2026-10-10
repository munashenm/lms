import { describe, expect, it } from "vitest";
import { SCHEDULED_JOBS, nextDailyRunAt, sanitizeSchedulerError } from "@/lib/scheduler/catalog";

describe("in-process scheduler", () => {
  it("runs the licence heartbeat, backups and fee reminders, and holds the other jobs", () => {
    const automatic = SCHEDULED_JOBS.filter((job) => job.automatic).map((job) => job.key);
    expect(automatic).toEqual(["license-heartbeat", "backups", "fee-reminders"]);
    expect(SCHEDULED_JOBS.find((job) => job.key === "backups")?.cadence).toBe("hourly");
    expect(SCHEDULED_JOBS.find((job) => job.key === "fee-reminders")?.cadence).toBe("daily");
    expect(SCHEDULED_JOBS.filter((job) => !job.automatic).map((job) => job.key)).toEqual([
      "import-cleanup",
      "leave-accrual",
      "recurring-expenses",
    ]);
    expect(SCHEDULED_JOBS).toHaveLength(6);
  });

  it("schedules the next daily run at 15:00 UTC", () => {
    const morning = nextDailyRunAt(new Date("2026-10-10T08:00:00.000Z"));
    expect(morning.toISOString()).toBe("2026-10-10T15:00:00.000Z");
    const after = nextDailyRunAt(new Date("2026-10-10T15:00:00.000Z"));
    expect(after.toISOString()).toBe("2026-10-11T15:00:00.000Z");
    const later = nextDailyRunAt(new Date("2026-10-10T18:30:00.000Z"));
    expect(later.toISOString()).toBe("2026-10-11T15:00:00.000Z");
  });

  it("strips secrets from scheduler errors", () => {
    const cleaned = sanitizeSchedulerError(new Error("failed Bearer cron-secret SHSA-ABCD-EFGH-IJKL re_live_secretkey"));
    expect(cleaned).not.toContain("cron-secret");
    expect(cleaned).not.toContain("SHSA-");
    expect(cleaned).not.toContain("re_live");
    expect(cleaned).toContain("[redacted]");
  });
});
