-- AlterTable
ALTER TABLE "report_cards" ADD COLUMN "snapshot" JSONB;

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN "snapshot" JSONB;

-- AlterTable
ALTER TABLE "issued_letters" ADD COLUMN "snapshot" JSONB;
