-- CreateEnum
CREATE TYPE "CommunicationBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "communication_batches" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "category" "CommunicationCategory" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "CommunicationBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "communication_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable communication_logs
ALTER TABLE "communication_logs" ADD COLUMN "batchId" TEXT;
ALTER TABLE "communication_logs" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "communication_batches_schoolId_createdAt_idx" ON "communication_batches"("schoolId", "createdAt");
CREATE INDEX "communication_batches_schoolId_status_idx" ON "communication_batches"("schoolId", "status");
CREATE INDEX "communication_logs_batchId_status_idx" ON "communication_logs"("batchId", "status");

ALTER TABLE "communication_batches" ADD CONSTRAINT "communication_batches_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "communication_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
