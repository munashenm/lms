-- Additive counter only. Existing payment rows and receipt numbers are not rewritten.

CREATE TABLE "receipt_sequences" (
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("schoolId","year")
);

ALTER TABLE "receipt_sequences" ADD CONSTRAINT "receipt_sequences_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
