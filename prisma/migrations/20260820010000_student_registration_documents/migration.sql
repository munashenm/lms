-- CreateEnum
CREATE TYPE "StudentDocumentType" AS ENUM ('BIRTH_CERTIFICATE', 'ID_PASSPORT', 'PAST_RESULTS', 'OTHER');

-- CreateTable
CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentDocumentType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_documents_studentId_type_idx" ON "student_documents"("studentId", "type");

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
