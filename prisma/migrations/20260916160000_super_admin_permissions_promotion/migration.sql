-- Enrolment progression outcome used by colleges and TVET programmes
ALTER TYPE "EnrolmentStatus" ADD VALUE IF NOT EXISTS 'PROGRESSED';

-- User access overrides, campus assignment and forced password reset
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "campusId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissionGrants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissionDenies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "users_campusId_idx" ON "users"("campusId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_campusId_fkey"
  FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Richer student profile fields
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "passportNumber" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "alternativeId" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "preferredName" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "homeLanguage" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "postalAddress" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyName" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyRelationship" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TYPE "PromotionEligibility" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'REVIEW_REQUIRED');
CREATE TYPE "PromotionOutcome" AS ENUM ('PROMOTED', 'REPEATED', 'PROGRESSED', 'GRADUATED', 'COMPLETED', 'TRANSFERRED', 'WITHDRAWN', 'DEFERRED');

-- Per-institution module switches (missing row = enabled)
CREATE TABLE IF NOT EXISTS "school_modules" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_modules_schoolId_moduleKey_key" ON "school_modules"("schoolId", "moduleKey");
CREATE INDEX IF NOT EXISTS "school_modules_schoolId_idx" ON "school_modules"("schoolId");

ALTER TABLE "school_modules"
  ADD CONSTRAINT "school_modules_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "student_change_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_change_logs_studentId_createdAt_idx" ON "student_change_logs"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "student_change_logs_schoolId_createdAt_idx" ON "student_change_logs"("schoolId", "createdAt");

ALTER TABLE "student_change_logs"
  ADD CONSTRAINT "student_change_logs_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_change_logs"
  ADD CONSTRAINT "student_change_logs_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_change_logs"
  ADD CONSTRAINT "student_change_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "promotion_rules" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromGradeId" TEXT,
    "toGradeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minAverage" DECIMAL(5,2),
    "minAttendancePercent" DECIMAL(5,2),
    "requirePassStatus" BOOLEAN NOT NULL DEFAULT false,
    "minSubjectsPassed" INTEGER,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotion_rules_schoolId_idx" ON "promotion_rules"("schoolId");

ALTER TABLE "promotion_rules"
  ADD CONSTRAINT "promotion_rules_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_rules"
  ADD CONSTRAINT "promotion_rules_fromGradeId_fkey"
  FOREIGN KEY ("fromGradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_rules"
  ADD CONSTRAINT "promotion_rules_toGradeId_fkey"
  FOREIGN KEY ("toGradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "promotion_decisions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolmentId" TEXT,
    "fromAcademicYearId" TEXT NOT NULL,
    "toAcademicYearId" TEXT,
    "fromGradeId" TEXT,
    "toGradeId" TEXT,
    "toClassId" TEXT,
    "eligibility" "PromotionEligibility" NOT NULL,
    "outcome" "PromotionOutcome",
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "notes" TEXT,
    "average" DECIMAL(5,2),
    "attendancePercent" DECIMAL(5,2),
    "resultStatus" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotion_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotion_decisions_schoolId_createdAt_idx" ON "promotion_decisions"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "promotion_decisions_studentId_idx" ON "promotion_decisions"("studentId");
CREATE INDEX IF NOT EXISTS "promotion_decisions_fromAcademicYearId_idx" ON "promotion_decisions"("fromAcademicYearId");

ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_enrolmentId_fkey"
  FOREIGN KEY ("enrolmentId") REFERENCES "enrolments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_fromAcademicYearId_fkey"
  FOREIGN KEY ("fromAcademicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_toAcademicYearId_fkey"
  FOREIGN KEY ("toAcademicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_fromGradeId_fkey"
  FOREIGN KEY ("fromGradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_toGradeId_fkey"
  FOREIGN KEY ("toGradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions"
  ADD CONSTRAINT "promotion_decisions_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
