-- School banking details printed on fee invoices and statements (not staff payroll).
ALTER TABLE "schools" ADD COLUMN "bankName" TEXT;
ALTER TABLE "schools" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "schools" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "schools" ADD COLUMN "bankBranchCode" TEXT;
