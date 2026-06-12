-- Staff leave: all staff can apply, sick note upload support

ALTER TABLE "leave_requests" ADD COLUMN "userId" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "sickNoteUrl" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "sickNoteFilename" TEXT;

UPDATE "leave_requests" lr
SET "userId" = t."userId"
FROM "teachers" t
WHERE lr."teacherId" = t.id AND t."userId" IS NOT NULL;

DELETE FROM "leave_requests" WHERE "userId" IS NULL;

ALTER TABLE "leave_requests" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "leave_requests" ALTER COLUMN "teacherId" DROP NOT NULL;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "leave_requests_userId_idx" ON "leave_requests"("userId");
