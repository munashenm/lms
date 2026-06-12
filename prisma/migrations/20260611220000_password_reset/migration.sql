ALTER TABLE "users" ADD COLUMN "passwordResetTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);
