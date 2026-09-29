-- Admissions deposit workflow statuses + waiver fields, CEMIS per-institution gate.
-- Additive only; does not rewrite 20260929120000_compliance_finance_admissions.

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PAID';

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositWaivedAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositWaiverReason" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositWaivedById" TEXT;

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "cemisEnabled" BOOLEAN NOT NULL DEFAULT false;
