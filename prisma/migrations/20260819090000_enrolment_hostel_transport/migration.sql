-- Persist hostel/transport flags on enrolment so those fee structures can auto-apply.
ALTER TABLE "enrolments" ADD COLUMN "hostel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "enrolments" ADD COLUMN "transport" BOOLEAN NOT NULL DEFAULT false;
