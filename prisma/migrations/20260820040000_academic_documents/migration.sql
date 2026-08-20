-- AlterTable
ALTER TABLE "schools" ADD COLUMN "requireFeesPaidForDocuments" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "IssuedLetterType" AS ENUM ('TRANSFER', 'TESTIMONIAL', 'LEAVING', 'FEE_CLEARANCE', 'TRANSCRIPT');

-- CreateTable
CREATE TABLE "issued_letters" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "IssuedLetterType" NOT NULL,
    "letterNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destinationSchool" TEXT,
    "reason" TEXT,
    "bodyText" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issued_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issued_letters_schoolId_letterNo_key" ON "issued_letters"("schoolId", "letterNo");

-- CreateIndex
CREATE INDEX "issued_letters_studentId_idx" ON "issued_letters"("studentId");

-- AddForeignKey
ALTER TABLE "issued_letters" ADD CONSTRAINT "issued_letters_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_letters" ADD CONSTRAINT "issued_letters_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_letters" ADD CONSTRAINT "issued_letters_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
