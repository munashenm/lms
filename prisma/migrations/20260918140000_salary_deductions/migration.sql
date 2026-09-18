-- Additive: extra employee deductions on salary structures (staff loans, garnishee, etc.)
ALTER TABLE "salary_structures" ADD COLUMN IF NOT EXISTS "deductionsJson" JSONB;
