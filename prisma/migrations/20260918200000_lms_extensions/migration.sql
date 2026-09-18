-- CreateEnum
CREATE TYPE "PaymentCaptureStatus" AS ENUM ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "GatewayPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'DENIED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('SUBMITTED', 'LATE', 'GRADED', 'RETURNED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYPAL';

-- AlterEnum
ALTER TYPE "CommunicationStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "captureStatus" "PaymentCaptureStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bankReference" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "feeType" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "overpaymentCredit" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gatewayStatus" "GatewayPaymentStatus";
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gatewayTxnId" TEXT;

UPDATE "payments"
SET "postedAt" = "createdAt", "approvedAt" = "createdAt"
WHERE "reversedAt" IS NULL AND "reversalOfId" IS NULL AND "postedAt" IS NULL;

UPDATE "payments"
SET "captureStatus" = 'REVERSED'
WHERE "reversedAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "payments_schoolId_captureStatus_idx" ON "payments"("schoolId", "captureStatus");
CREATE INDEX IF NOT EXISTS "payments_schoolId_bankReference_idx" ON "payments"("schoolId", "bankReference");
CREATE INDEX IF NOT EXISTS "payments_gatewayTxnId_idx" ON "payments"("gatewayTxnId");

-- Assignment submissions
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "fileUrls" JSONB;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED';
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "late" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);

UPDATE "assignment_submissions"
SET "status" = 'GRADED'
WHERE "grade" IS NOT NULL;

-- Integrations
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paypalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paypalClientId" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paypalSecret" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paypalSandbox" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paypalCurrency" TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsProvider" TEXT NOT NULL DEFAULT 'TWILIO';
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestUrl" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestMethod" TEXT NOT NULL DEFAULT 'POST';
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestApiKey" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestFrom" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestBodyTemplate" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "smsRestAuthHeader" TEXT;

-- Communication logs
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(10,4);
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Visitors
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "itemsBrought" TEXT;
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "status" "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN';
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "expectedAt" TIMESTAMP(3);
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "expectedDepartureAt" TIMESTAMP(3);
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "idScanUrl" TEXT;
ALTER TABLE "visitor_entries" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;

UPDATE "visitor_entries" SET "status" = 'CHECKED_OUT' WHERE "signedOutAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "visitor_entries_schoolId_status_idx" ON "visitor_entries"("schoolId", "status");

-- Internal messaging
CREATE TABLE IF NOT EXISTS "internal_messages" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "threadId" TEXT,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message_recipients" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_recipients_messageId_userId_key" ON "message_recipients"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "internal_messages_schoolId_createdAt_idx" ON "internal_messages"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "internal_messages_senderId_createdAt_idx" ON "internal_messages"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "internal_messages_threadId_idx" ON "internal_messages"("threadId");
CREATE INDEX IF NOT EXISTS "message_recipients_userId_readAt_idx" ON "message_recipients"("userId", "readAt");

ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "internal_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "internal_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
