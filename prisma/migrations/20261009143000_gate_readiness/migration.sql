-- Production-readiness for gate access.
-- Additive: existing attendance rows keep their userId. Employees can now have attendance without a login.

ALTER TABLE "staff_attendance_records" ALTER COLUMN "userId" DROP NOT NULL;

-- PostgreSQL unique indexes treat NULL employeeId values as distinct, so login-only rows are unchanged.
CREATE UNIQUE INDEX "staff_attendance_records_employeeId_date_key" ON "staff_attendance_records"("employeeId", "date");

ALTER TABLE "gate_policies" ADD COLUMN "dayBoundaryTime" TEXT NOT NULL DEFAULT '18:00';

CREATE TYPE "EarlyReleaseStatus" AS ENUM ('PENDING', 'APPROVED', 'USED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "early_release_authorizations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EarlyReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "reason" "EarlyDepartureReason" NOT NULL,
    "note" TEXT,
    "validOn" DATE NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_release_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_checkout_reconciliations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gateEventId" TEXT,
    "visitorEntryId" TEXT,
    "personKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reconciledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_checkout_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gate_checkout_reconciliations_gateEventId_key" ON "gate_checkout_reconciliations"("gateEventId");
CREATE UNIQUE INDEX "gate_checkout_reconciliations_visitorEntryId_key" ON "gate_checkout_reconciliations"("visitorEntryId");
CREATE INDEX "gate_checkout_reconciliations_schoolId_createdAt_idx" ON "gate_checkout_reconciliations"("schoolId", "createdAt");
CREATE INDEX "early_release_authorizations_schoolId_studentId_validOn_idx" ON "early_release_authorizations"("schoolId", "studentId", "validOn");

ALTER TABLE "early_release_authorizations" ADD CONSTRAINT "early_release_authorizations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "early_release_authorizations" ADD CONSTRAINT "early_release_authorizations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_releaseAuthorizationId_fkey" FOREIGN KEY ("releaseAuthorizationId") REFERENCES "early_release_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gate_checkout_reconciliations" ADD CONSTRAINT "gate_checkout_reconciliations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_checkout_reconciliations" ADD CONSTRAINT "gate_checkout_reconciliations_gateEventId_fkey" FOREIGN KEY ("gateEventId") REFERENCES "gate_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_checkout_reconciliations" ADD CONSTRAINT "gate_checkout_reconciliations_visitorEntryId_fkey" FOREIGN KEY ("visitorEntryId") REFERENCES "visitor_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_checkout_reconciliations" ADD CONSTRAINT "gate_checkout_reconciliations_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
