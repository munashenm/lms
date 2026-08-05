-- CreateTable
CREATE TABLE "fee_reminder_rules" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOffset" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailTemplate" TEXT,
    "smsTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_reminder_dispatches" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "communicationLogId" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_reminder_rules_schoolId_daysOffset_channel_key" ON "fee_reminder_rules"("schoolId", "daysOffset", "channel");
CREATE INDEX "fee_reminder_rules_schoolId_isEnabled_idx" ON "fee_reminder_rules"("schoolId", "isEnabled");
CREATE UNIQUE INDEX "fee_reminder_dispatches_ruleId_invoiceId_channel_key" ON "fee_reminder_dispatches"("ruleId", "invoiceId", "channel");
CREATE INDEX "fee_reminder_dispatches_schoolId_dispatchedAt_idx" ON "fee_reminder_dispatches"("schoolId", "dispatchedAt");
CREATE INDEX "fee_reminder_dispatches_studentId_idx" ON "fee_reminder_dispatches"("studentId");
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

ALTER TABLE "fee_reminder_rules" ADD CONSTRAINT "fee_reminder_rules_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_reminder_dispatches" ADD CONSTRAINT "fee_reminder_dispatches_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_reminder_dispatches" ADD CONSTRAINT "fee_reminder_dispatches_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "fee_reminder_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_reminder_dispatches" ADD CONSTRAINT "fee_reminder_dispatches_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
