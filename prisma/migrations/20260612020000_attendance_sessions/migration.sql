-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK';

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN "subjectId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "moduleId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "sessionKey" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "attendance_records" ADD COLUMN "sessionStart" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "sessionEnd" TEXT;

-- Backfill session keys for existing daily class registers
UPDATE "attendance_records"
SET "sessionKey" = CASE
  WHEN "classId" IS NOT NULL THEN 'class:' || "classId"
  ELSE 'daily'
END;

-- Drop old unique and add session-aware unique
DROP INDEX IF EXISTS "attendance_records_studentId_date_classId_key";
CREATE UNIQUE INDEX "attendance_records_studentId_date_sessionKey_key"
  ON "attendance_records"("studentId", "date", "sessionKey");

CREATE INDEX "attendance_records_classId_date_idx" ON "attendance_records"("classId", "date");
CREATE INDEX "attendance_records_moduleId_date_idx" ON "attendance_records"("moduleId", "date");
CREATE INDEX "attendance_records_termId_date_idx" ON "attendance_records"("termId", "date");

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
