-- Session revocation: incrementing this invalidates outstanding JWTs
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;
