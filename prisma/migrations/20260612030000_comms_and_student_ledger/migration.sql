-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');
CREATE TYPE "CommunicationCategory" AS ENUM ('ABSENCE_ALERT', 'FEE_REMINDER', 'FEE_STATEMENT', 'ACADEMIC_NOTICE', 'EXAM_NOTICE', 'ANNOUNCEMENT', 'EMERGENCY', 'GENERAL');
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'LOGGED');
CREATE TYPE "StudentLedgerType" AS ENUM ('CHARGE', 'PAYMENT', 'CREDIT', 'DISCOUNT', 'BURSARY', 'SPONSORSHIP', 'ADJUSTMENT', 'REFUND');

-- AlterTable schools
ALTER TABLE "schools" ADD COLUMN "absenceNotifyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable student_ledger_entries
CREATE TABLE "student_ledger_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "type" "StudentLedgerType" NOT NULL,
    "description" TEXT NOT NULL,
    "signedAmount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable communication_logs
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "category" "CommunicationCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "CommunicationStatus" NOT NULL DEFAULT 'LOGGED',
    "recipientName" TEXT,
    "recipientContact" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_ledger_entries_schoolId_studentId_entryDate_idx" ON "student_ledger_entries"("schoolId", "studentId", "entryDate");
CREATE INDEX "student_ledger_entries_studentId_entryDate_idx" ON "student_ledger_entries"("studentId", "entryDate");
CREATE INDEX "student_ledger_entries_invoiceId_idx" ON "student_ledger_entries"("invoiceId");
CREATE INDEX "student_ledger_entries_paymentId_idx" ON "student_ledger_entries"("paymentId");
CREATE INDEX "communication_logs_schoolId_createdAt_idx" ON "communication_logs"("schoolId", "createdAt");
CREATE INDEX "communication_logs_studentId_createdAt_idx" ON "communication_logs"("studentId", "createdAt");
CREATE INDEX "communication_logs_category_status_idx" ON "communication_logs"("category", "status");

ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
