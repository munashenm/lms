-- Lease and run history for the in-process scheduler. No licence or school data changes.

CREATE TABLE "scheduler_job_states" (
    "jobKey" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduler_job_states_pkey" PRIMARY KEY ("jobKey")
);
