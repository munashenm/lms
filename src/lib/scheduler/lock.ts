import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

const DEFAULT_LEASE_MS = 10 * 60 * 1000;

export interface JobLease {
  jobKey: string;
  owner: string;
}

/** Returns a lease when this process owns the job. Expired leases can be taken. */
export async function tryAcquireJobLease(jobKey: string, leaseMs = DEFAULT_LEASE_MS): Promise<JobLease | null> {
  const owner = `${process.pid}:${randomUUID()}`;
  const until = new Date(Date.now() + leaseMs);
  const changed = await prisma.$executeRaw`
    INSERT INTO "scheduler_job_states" ("jobKey", "lockedUntil", "lockedBy", "lastStartedAt", "updatedAt")
    VALUES (${jobKey}, ${until}, ${owner}, ${new Date()}, NOW())
    ON CONFLICT ("jobKey") DO UPDATE
    SET "lockedUntil" = ${until},
        "lockedBy" = ${owner},
        "lastStartedAt" = ${new Date()},
        "updatedAt" = NOW()
    WHERE "scheduler_job_states"."lockedUntil" IS NULL
       OR "scheduler_job_states"."lockedUntil" < NOW()
  `;
  if (Number(changed) < 1) return null;
  const row = await prisma.schedulerJobState.findUnique({
    where: { jobKey },
    select: { lockedBy: true },
  });
  if (row?.lockedBy !== owner) return null;
  return { jobKey, owner };
}

export async function releaseJobLease(lease: JobLease, outcome: { ok: boolean; error?: string; nextRunAt?: Date | null }) {
  const now = new Date();
  await prisma.schedulerJobState.updateMany({
    where: { jobKey: lease.jobKey, lockedBy: lease.owner },
    data: {
      lockedUntil: null,
      lockedBy: null,
      lastSuccessAt: outcome.ok ? now : undefined,
      lastFailureAt: outcome.ok ? undefined : now,
      lastError: outcome.ok ? null : (outcome.error ?? "Scheduled job failed"),
      nextRunAt: outcome.nextRunAt === undefined ? undefined : outcome.nextRunAt,
    },
  });
}
