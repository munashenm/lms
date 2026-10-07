-- Additive commercial pricing on school licences (nullable for existing rows).
ALTER TABLE "school_licenses"
  ADD COLUMN IF NOT EXISTS "pricePerLearner" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "priceCurrency" TEXT NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS "priceNotes" TEXT;
