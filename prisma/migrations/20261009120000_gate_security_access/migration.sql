-- Gate, security and access control.
-- Additive and backwards-compatible: existing attendance, visitor and user rows are left in place.

CREATE TYPE "GatePersonType" AS ENUM ('STUDENT', 'STAFF', 'VISITOR');
CREATE TYPE "GateDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "GateScanMethod" AS ENUM ('QR', 'BARCODE', 'CAMERA', 'RFID', 'NFC', 'BIOMETRIC', 'MANUAL');
CREATE TYPE "GateEventOutcome" AS ENUM ('RECORDED', 'DUPLICATE', 'DENIED', 'EARLY_DEPARTURE');
CREATE TYPE "GatePunctuality" AS ENUM ('ON_TIME', 'LATE', 'EARLY', 'NORMAL', 'UNKNOWN');
CREATE TYPE "AccessCardStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'REPLACED');
CREATE TYPE "AccessCardHolder" AS ENUM ('STUDENT', 'STAFF');
CREATE TYPE "EarlyDepartureReason" AS ENUM ('PARENT_COLLECTION', 'MEDICAL', 'SCHOOL_ACTIVITY', 'AUTHORIZED_LEAVE', 'EMERGENCY', 'OTHER');

ALTER TABLE "attendance_records" ADD COLUMN "gateArrivalAt" TIMESTAMP(3);
ALTER TABLE "attendance_records" ADD COLUMN "gateDepartureAt" TIMESTAMP(3);

ALTER TABLE "visitor_entries" ADD COLUMN "referenceNumber" TEXT;
CREATE UNIQUE INDEX "visitor_entries_schoolId_referenceNumber_key" ON "visitor_entries"("schoolId", "referenceNumber");

CREATE TABLE "gate_checkpoints" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_policies" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolStartTime" TEXT NOT NULL DEFAULT '07:30',
    "lateAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "normalDepartureTime" TEXT NOT NULL DEFAULT '14:00',
    "duplicateScanIntervalSeconds" INTEGER NOT NULL DEFAULT 90,
    "requireVisitorIdentity" BOOLEAN NOT NULL DEFAULT false,
    "allowVisitorPhoto" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_cards" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "holderType" "AccessCardHolder" NOT NULL,
    "studentId" TEXT,
    "userId" TEXT,
    "employeeId" TEXT,
    "token" TEXT NOT NULL,
    "status" "AccessCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "deactivationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "personType" "GatePersonType" NOT NULL,
    "personKey" TEXT NOT NULL,
    "studentId" TEXT,
    "userId" TEXT,
    "employeeId" TEXT,
    "visitorEntryId" TEXT,
    "direction" "GateDirection" NOT NULL,
    "method" "GateScanMethod" NOT NULL,
    "gateId" TEXT,
    "deviceId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "outcome" "GateEventOutcome" NOT NULL,
    "punctuality" "GatePunctuality",
    "denialCode" TEXT,
    "earlyDepartureReason" "EarlyDepartureReason",
    "earlyDepartureNote" TEXT,
    "releaseAuthorizationId" TEXT,
    "notes" TEXT,
    "manualReason" TEXT,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visitor_reference_counters" (
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitor_reference_counters_pkey" PRIMARY KEY ("schoolId","year")
);

CREATE UNIQUE INDEX "gate_checkpoints_schoolId_code_key" ON "gate_checkpoints"("schoolId", "code");
CREATE INDEX "gate_checkpoints_schoolId_isActive_idx" ON "gate_checkpoints"("schoolId", "isActive");
CREATE UNIQUE INDEX "gate_policies_schoolId_key" ON "gate_policies"("schoolId");
CREATE UNIQUE INDEX "access_cards_token_key" ON "access_cards"("token");
CREATE INDEX "access_cards_schoolId_status_idx" ON "access_cards"("schoolId", "status");
CREATE INDEX "access_cards_schoolId_studentId_idx" ON "access_cards"("schoolId", "studentId");
CREATE INDEX "access_cards_schoolId_userId_idx" ON "access_cards"("schoolId", "userId");
CREATE INDEX "access_cards_token_idx" ON "access_cards"("token");
CREATE INDEX "gate_events_schoolId_scannedAt_idx" ON "gate_events"("schoolId", "scannedAt");
CREATE INDEX "gate_events_schoolId_personKey_scannedAt_idx" ON "gate_events"("schoolId", "personKey", "scannedAt");
CREATE INDEX "gate_events_schoolId_outcome_scannedAt_idx" ON "gate_events"("schoolId", "outcome", "scannedAt");
CREATE INDEX "gate_events_studentId_scannedAt_idx" ON "gate_events"("studentId", "scannedAt");
CREATE INDEX "gate_events_userId_scannedAt_idx" ON "gate_events"("userId", "scannedAt");
CREATE INDEX "gate_events_visitorEntryId_idx" ON "gate_events"("visitorEntryId");

ALTER TABLE "gate_checkpoints" ADD CONSTRAINT "gate_checkpoints_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_policies" ADD CONSTRAINT "gate_policies_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_cards" ADD CONSTRAINT "access_cards_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_visitorEntryId_fkey" FOREIGN KEY ("visitorEntryId") REFERENCES "visitor_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gate_checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitor_reference_counters" ADD CONSTRAINT "visitor_reference_counters_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
