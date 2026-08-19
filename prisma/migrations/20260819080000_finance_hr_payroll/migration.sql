-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'HR_OFFICER';
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_DEPOSIT';
ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE';
ALTER TYPE "LeaveType" ADD VALUE 'MATERNITY';
ALTER TYPE "LeaveType" ADD VALUE 'STUDY';

-- CreateEnum
CREATE TYPE "FeeChargeSource" AS ENUM ('GRADE_FEE', 'CLASS_FEE', 'COURSE_FEE', 'MODULE_FEE', 'REGISTRATION_FEE', 'HOSTEL_FEE', 'TRANSPORT_FEE', 'MANUAL_CHARGE');
CREATE TYPE "BillingFrequency" AS ENUM ('ONCE', 'MONTHLY', 'TERMLY', 'SEMESTER', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'POSTED');
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'HOURLY');
CREATE TYPE "EmployeeCategory" AS ENUM ('EDUCATOR', 'PRINCIPAL', 'DEPUTY_PRINCIPAL', 'ADMINISTRATION', 'FINANCE', 'HR', 'LIBRARIAN', 'IT', 'CLEANER', 'SECURITY', 'DRIVER', 'MAINTENANCE', 'MANAGEMENT', 'OTHER');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'FINALISED', 'REVERSED');
CREATE TYPE "InstalmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELLED');
CREATE TYPE "AccrualMethod" AS ENUM ('NONE', 'MONTHLY', 'YEARLY');
CREATE TYPE "EmployeeDocumentType" AS ENUM ('ID_PASSPORT', 'CONTRACT', 'QUALIFICATION', 'CERTIFICATE', 'CV', 'DISCIPLINARY', 'POLICY_ACK', 'OTHER');
CREATE TYPE "StudentAidType" AS ENUM ('DISCOUNT', 'BURSARY', 'SCHOLARSHIP', 'SPONSORSHIP');
CREATE TYPE "RecurringInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');
CREATE TYPE "SalaryPayType" AS ENUM ('MONTHLY', 'HOURLY');

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "payments" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "payments" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "reversalOfId" TEXT;
ALTER TABLE "payments" ADD COLUMN "recordedById" TEXT;
ALTER TABLE "payments" ADD COLUMN "gatewayProvider" TEXT;

UPDATE "payments" p
SET
  "schoolId" = i."schoolId",
  "receiptNumber" = 'RCP-' || EXTRACT(YEAR FROM p."paidAt")::int || '-' || UPPER(RIGHT(p."id", 8))
FROM "invoices" i
WHERE p."invoiceId" = i."id";

UPDATE "payments" SET "schoolId" = 'unknown', "receiptNumber" = 'RCP-LEGACY-' || "id" WHERE "schoolId" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "receiptNumber" SET NOT NULL;

CREATE UNIQUE INDEX "payments_schoolId_receiptNumber_key" ON "payments"("schoolId", "receiptNumber");
CREATE INDEX "payments_schoolId_paidAt_idx" ON "payments"("schoolId", "paidAt");

ALTER TABLE "payments" ADD CONSTRAINT "payments_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable student_ledger_entries
ALTER TABLE "student_ledger_entries" ADD COLUMN "chargeSource" "FeeChargeSource";
ALTER TABLE "student_ledger_entries" ADD COLUMN "studentChargeId" TEXT;
ALTER TABLE "student_ledger_entries" ADD COLUMN "reversesEntryId" TEXT;

ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "student_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable ledger_entries
ALTER TABLE "ledger_entries" ADD COLUMN "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ledger_entries" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "financialAccountId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "payrollRunId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "expenseId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "otherIncomeId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'POSTED';
ALTER TABLE "ledger_entries" ADD COLUMN "attachmentUrl" TEXT;

CREATE UNIQUE INDEX "ledger_entries_expenseId_key" ON "ledger_entries"("expenseId");
CREATE UNIQUE INDEX "ledger_entries_otherIncomeId_key" ON "ledger_entries"("otherIncomeId");

-- AlterTable leave_requests
ALTER TABLE "leave_requests" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "leavePolicyId" TEXT;

-- AlterTable staff_attendance_records
ALTER TABLE "staff_attendance_records" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "staff_attendance_records" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "staff_attendance_records" ADD COLUMN "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable enrolment_modules
CREATE TABLE "enrolment_modules" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrolment_modules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "enrolment_modules_enrolmentId_moduleId_key" ON "enrolment_modules"("enrolmentId", "moduleId");
CREATE INDEX "enrolment_modules_moduleId_idx" ON "enrolment_modules"("moduleId");

-- CreateTable fee_structures
CREATE TABLE "fee_structures" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chargeSource" "FeeChargeSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingFrequency" "BillingFrequency" NOT NULL DEFAULT 'ONCE',
    "allowInstalments" BOOLEAN NOT NULL DEFAULT false,
    "instalmentCount" INTEGER,
    "customScheduleJson" JSONB,
    "academicYearId" TEXT,
    "termId" TEXT,
    "campusId" TEXT,
    "gradeId" TEXT,
    "classId" TEXT,
    "courseId" TEXT,
    "moduleId" TEXT,
    "qualification" TEXT,
    "dueDayOfMonth" INTEGER,
    "applyOnEnrolment" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_structures_schoolId_isActive_chargeSource_idx" ON "fee_structures"("schoolId", "isActive", "chargeSource");
CREATE INDEX "fee_structures_schoolId_academicYearId_idx" ON "fee_structures"("schoolId", "academicYearId");

-- CreateTable student_charges
CREATE TABLE "student_charges" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolmentId" TEXT,
    "feeStructureId" TEXT,
    "academicYearId" TEXT,
    "invoiceId" TEXT,
    "source" "FeeChargeSource" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_charges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_charges_idempotencyKey_key" ON "student_charges"("idempotencyKey");
CREATE INDEX "student_charges_schoolId_studentId_idx" ON "student_charges"("schoolId", "studentId");
CREATE INDEX "student_charges_studentId_academicYearId_idx" ON "student_charges"("studentId", "academicYearId");

-- CreateTable charge_instalments
CREATE TABLE "charge_instalments" (
    "id" TEXT NOT NULL,
    "studentChargeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InstalmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_instalments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "charge_instalments_studentChargeId_sequence_key" ON "charge_instalments"("studentChargeId", "sequence");
CREATE INDEX "charge_instalments_dueDate_status_idx" ON "charge_instalments"("dueDate", "status");

-- CreateTable payment_allocations
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "instalmentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");
CREATE INDEX "payment_allocations_schoolId_idx" ON "payment_allocations"("schoolId");

-- CreateTable credit_notes
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "invoiceId" TEXT,
    "ledgerEntryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_notes_schoolId_number_key" ON "credit_notes"("schoolId", "number");
CREATE UNIQUE INDEX "credit_notes_ledgerEntryId_key" ON "credit_notes"("ledgerEntryId");
CREATE INDEX "credit_notes_studentId_idx" ON "credit_notes"("studentId");

-- CreateTable refunds
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "ledgerEntryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refunds_ledgerEntryId_key" ON "refunds"("ledgerEntryId");
CREATE INDEX "refunds_schoolId_status_idx" ON "refunds"("schoolId", "status");
CREATE INDEX "refunds_studentId_idx" ON "refunds"("studentId");

-- CreateTable student_aid_awards
CREATE TABLE "student_aid_awards" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "type" "StudentAidType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ledgerEntryId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_aid_awards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_aid_awards_ledgerEntryId_key" ON "student_aid_awards"("ledgerEntryId");
CREATE INDEX "student_aid_awards_schoolId_studentId_idx" ON "student_aid_awards"("schoolId", "studentId");

-- CreateTable suppliers
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "accountRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "suppliers_schoolId_name_idx" ON "suppliers"("schoolId", "name");

-- CreateTable expense_categories
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_categories_schoolId_name_key" ON "expense_categories"("schoolId", "name");

-- CreateTable income_categories
CREATE TABLE "income_categories" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "income_categories_schoolId_name_key" ON "income_categories"("schoolId", "name");

-- CreateTable financial_accounts
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BANK',
    "accountRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "financial_accounts_schoolId_idx" ON "financial_accounts"("schoolId");

-- CreateTable recurring_expenses
CREATE TABLE "recurring_expenses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "supplierId" TEXT,
    "categoryId" TEXT,
    "financialAccountId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "interval" "RecurringInterval" NOT NULL DEFAULT 'MONTHLY',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "requireConfirm" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recurring_expenses_schoolId_isActive_nextDueDate_idx" ON "recurring_expenses"("schoolId", "isActive", "nextDueDate");

-- CreateTable expenses
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "supplierId" TEXT,
    "categoryId" TEXT,
    "financialAccountId" TEXT,
    "recurringExpenseId" TEXT,
    "description" TEXT NOT NULL,
    "invoiceRef" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_schoolId_transactionDate_idx" ON "expenses"("schoolId", "transactionDate");
CREATE INDEX "expenses_schoolId_approvalStatus_idx" ON "expenses"("schoolId", "approvalStatus");

-- CreateTable other_incomes
CREATE TABLE "other_incomes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT,
    "financialAccountId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_incomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "other_incomes_schoolId_receivedAt_idx" ON "other_incomes"("schoolId", "receivedAt");

-- CreateTable employees
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "teacherId" TEXT,
    "campusId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "saIdNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "address" TEXT,
    "category" "EmployeeCategory" NOT NULL DEFAULT 'OTHER',
    "department" TEXT,
    "position" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountLast4" TEXT,
    "bankAccountEnc" TEXT,
    "branchCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");
CREATE UNIQUE INDEX "employees_teacherId_key" ON "employees"("teacherId");
CREATE UNIQUE INDEX "employees_schoolId_employeeNumber_key" ON "employees"("schoolId", "employeeNumber");
CREATE INDEX "employees_schoolId_status_idx" ON "employees"("schoolId", "status");
CREATE INDEX "employees_schoolId_campusId_idx" ON "employees"("schoolId", "campusId");

-- CreateTable employment_contracts
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employment_contracts_employeeId_idx" ON "employment_contracts"("employeeId");

-- CreateTable salary_structures
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "payType" "SalaryPayType" NOT NULL DEFAULT 'MONTHLY',
    "baseSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(12,2),
    "allowancesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "salary_structures_employeeId_effectiveFrom_idx" ON "salary_structures"("employeeId", "effectiveFrom");

-- CreateTable employee_documents
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeDocumentType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_documents_employeeId_type_idx" ON "employee_documents"("employeeId", "type");

-- CreateTable leave_policies
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "name" TEXT NOT NULL,
    "daysPerYear" DECIMAL(6,2) NOT NULL,
    "accrualMethod" "AccrualMethod" NOT NULL DEFAULT 'NONE',
    "requiresHrApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_policies_schoolId_leaveType_name_key" ON "leave_policies"("schoolId", "leaveType", "name");
CREATE INDEX "leave_policies_schoolId_isActive_idx" ON "leave_policies"("schoolId", "isActive");

-- CreateTable leave_entitlements
CREATE TABLE "leave_entitlements" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "openingBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taken" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_entitlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_entitlements_employeeId_leavePolicyId_cycleYear_key" ON "leave_entitlements"("employeeId", "leavePolicyId", "cycleYear");

-- CreateTable timesheets
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "timesheets_employeeId_periodStart_idx" ON "timesheets"("employeeId", "periodStart");

-- CreateTable timesheet_entries
CREATE TABLE "timesheet_entries" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_entries_timesheetId_workDate_key" ON "timesheet_entries"("timesheetId", "workDate");

-- CreateTable payroll_rule_sets
CREATE TABLE "payroll_rule_sets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'ZA',
    "name" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "rulesJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_rule_sets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_rule_sets_schoolId_jurisdiction_effectiveFrom_idx" ON "payroll_rule_sets"("schoolId", "jurisdiction", "effectiveFrom");

-- CreateTable payroll_runs
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "ruleSetId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "totalGross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "finalisedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_runs_schoolId_periodStart_idx" ON "payroll_runs"("schoolId", "periodStart");
CREATE INDEX "payroll_runs_schoolId_status_idx" ON "payroll_runs"("schoolId", "status");

-- CreateTable payroll_items
CREATE TABLE "payroll_items" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPay" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "employerContributions" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "earningsJson" JSONB NOT NULL,
    "deductionsJson" JSONB NOT NULL,
    "employerJson" JSONB NOT NULL,
    "exceptionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_items_payrollRunId_employeeId_key" ON "payroll_items"("payrollRunId", "employeeId");

-- CreateTable payslips
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payslips_payrollItemId_key" ON "payslips"("payrollItemId");

-- Foreign keys
ALTER TABLE "enrolment_modules" ADD CONSTRAINT "enrolment_modules_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrolment_modules" ADD CONSTRAINT "enrolment_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "charge_instalments" ADD CONSTRAINT "charge_instalments_studentChargeId_fkey" FOREIGN KEY ("studentChargeId") REFERENCES "student_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_instalmentId_fkey" FOREIGN KEY ("instalmentId") REFERENCES "charge_instalments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_aid_awards" ADD CONSTRAINT "student_aid_awards_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_aid_awards" ADD CONSTRAINT "student_aid_awards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_otherIncomeId_fkey" FOREIGN KEY ("otherIncomeId") REFERENCES "other_incomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_ledger_entries" ADD CONSTRAINT "student_ledger_entries_studentChargeId_fkey" FOREIGN KEY ("studentChargeId") REFERENCES "student_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" ADD CONSTRAINT "employees_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "leave_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "leave_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_rule_sets" ADD CONSTRAINT "payroll_rule_sets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "payroll_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
