-- Lookup hashes for encrypted SA ID numbers. Existing plaintext IDs stay readable until rewritten on save.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "saIdNumberHash" TEXT;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "saIdNumberHash" TEXT;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "saIdNumberHash" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "saIdNumberHash" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "saIdNumberHash" TEXT;

CREATE INDEX IF NOT EXISTS "students_schoolId_saIdNumberHash_idx" ON "students" ("schoolId", "saIdNumberHash");
CREATE INDEX IF NOT EXISTS "teachers_schoolId_saIdNumberHash_idx" ON "teachers" ("schoolId", "saIdNumberHash");
CREATE INDEX IF NOT EXISTS "guardians_schoolId_saIdNumberHash_idx" ON "guardians" ("schoolId", "saIdNumberHash");
CREATE INDEX IF NOT EXISTS "applications_schoolId_saIdNumberHash_idx" ON "applications" ("schoolId", "saIdNumberHash");
CREATE INDEX IF NOT EXISTS "employees_schoolId_saIdNumberHash_idx" ON "employees" ("schoolId", "saIdNumberHash");
