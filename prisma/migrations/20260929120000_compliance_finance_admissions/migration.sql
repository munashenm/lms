-- CreateEnum
CREATE TYPE "PopulationGroup" AS ENUM ('AFRICAN', 'COLOURED', 'INDIAN', 'WHITE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "ComplianceExportKind" AS ENUM ('SASAMS_PACKAGE', 'LURITS_PROMOTION', 'CEMIS_MARKS');

-- CreateEnum
CREATE TYPE "ComplianceExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "FinanceProjectStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_ISSUED';

-- AlterTable students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "populationGroup" "PopulationGroup";
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "citizenship" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "countryOfBirth" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "disabilityStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "sneStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "disabilityNotes" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "luritsNumber" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previousEmisSchool" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "transferReason" TEXT;
CREATE INDEX IF NOT EXISTS "students_schoolId_luritsNumber_idx" ON "students"("schoolId", "luritsNumber");

-- AlterTable teachers
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "luritsNumber" TEXT;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "persalNumber" TEXT;
CREATE INDEX IF NOT EXISTS "teachers_schoolId_luritsNumber_idx" ON "teachers"("schoolId", "luritsNumber");

-- AlterTable applications
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offerSentAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offerExpiresAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(12,2);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "depositInvoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "applications_depositInvoiceId_idx" ON "applications"("depositInvoiceId");

-- CreateTable compliance_export_jobs
CREATE TABLE IF NOT EXISTS "compliance_export_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "ComplianceExportKind" NOT NULL,
    "status" "ComplianceExportStatus" NOT NULL DEFAULT 'PENDING',
    "academicYearId" TEXT,
    "termId" TEXT,
    "filename" TEXT,
    "mimeType" TEXT,
    "payload" JSONB,
    "summary" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "compliance_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable lurits_import_jobs
CREATE TABLE IF NOT EXISTS "lurits_import_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "summary" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "lurits_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable budgets
CREATE TABLE IF NOT EXISTS "budgets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "budget_lines" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance_projects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountRaised" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FinanceProjectStatus" NOT NULL DEFAULT 'OPEN',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "allowParentPay" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance_project_contributions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "payerName" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finance_project_contributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "compliance_export_jobs_schoolId_createdAt_idx" ON "compliance_export_jobs"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "compliance_export_jobs_schoolId_kind_idx" ON "compliance_export_jobs"("schoolId", "kind");
CREATE INDEX IF NOT EXISTS "lurits_import_jobs_schoolId_createdAt_idx" ON "lurits_import_jobs"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "budgets_schoolId_status_idx" ON "budgets"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "budget_lines_budgetId_idx" ON "budget_lines"("budgetId");
CREATE INDEX IF NOT EXISTS "finance_projects_schoolId_status_idx" ON "finance_projects"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "finance_project_contributions_projectId_idx" ON "finance_project_contributions"("projectId");
CREATE INDEX IF NOT EXISTS "finance_project_contributions_studentId_idx" ON "finance_project_contributions"("studentId");

DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_depositInvoiceId_fkey" FOREIGN KEY ("depositInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "compliance_export_jobs" ADD CONSTRAINT "compliance_export_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "lurits_import_jobs" ADD CONSTRAINT "lurits_import_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "budgets" ADD CONSTRAINT "budgets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "finance_projects" ADD CONSTRAINT "finance_projects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "finance_project_contributions" ADD CONSTRAINT "finance_project_contributions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
