-- AlterEnum InstitutionType
ALTER TYPE "InstitutionType" ADD VALUE 'PRIMARY_SCHOOL';
ALTER TYPE "InstitutionType" ADD VALUE 'HIGH_SCHOOL';
ALTER TYPE "InstitutionType" ADD VALUE 'COMBINED_SCHOOL';
ALTER TYPE "InstitutionType" ADD VALUE 'TRAINING_INSTITUTION';

-- CreateEnum
CREATE TYPE "AcademicPeriodStructure" AS ENUM ('TERMS_4', 'SEMESTERS_2', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AcademicSessionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AcademicPeriodStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- AlterTable schools
ALTER TABLE "schools" ADD COLUMN "periodStructure" "AcademicPeriodStructure" NOT NULL DEFAULT 'TERMS_4';

-- AlterTable academic_years
ALTER TABLE "academic_years" ADD COLUMN "status" "AcademicSessionStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "academic_years" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "academic_years" ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "academic_years" SET "status" = 'ACTIVE' WHERE "isCurrent" = true;
UPDATE "academic_years" SET "status" = 'CLOSED' WHERE "isCurrent" = false;

-- AlterTable terms
ALTER TABLE "terms" ADD COLUMN "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "terms" ADD COLUMN "resultsPublishingDate" TIMESTAMP(3);
ALTER TABLE "terms" ADD COLUMN "attendanceStartDate" TIMESTAMP(3);
ALTER TABLE "terms" ADD COLUMN "attendanceEndDate" TIMESTAMP(3);

UPDATE "terms" SET "status" = 'ACTIVE' WHERE "isCurrent" = true;
UPDATE "terms" SET "status" = 'CLOSED' WHERE "isCurrent" = false;

-- AlterTable enrolments
ALTER TABLE "enrolments" ADD COLUMN "gradeId" TEXT;
ALTER TABLE "enrolments" ADD COLUMN "classId" TEXT;
ALTER TABLE "enrolments" ADD COLUMN "notes" TEXT;

CREATE INDEX "academic_years_schoolId_status_idx" ON "academic_years"("schoolId", "status");
CREATE INDEX "academic_years_schoolId_isCurrent_idx" ON "academic_years"("schoolId", "isCurrent");
CREATE INDEX "terms_academicYearId_isCurrent_idx" ON "terms"("academicYearId", "isCurrent");
CREATE INDEX "enrolments_academicYearId_idx" ON "enrolments"("academicYearId");
CREATE INDEX "enrolments_studentId_academicYearId_idx" ON "enrolments"("studentId", "academicYearId");
CREATE INDEX "enrolments_gradeId_idx" ON "enrolments"("gradeId");
CREATE INDEX "enrolments_classId_idx" ON "enrolments"("classId");

ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
