-- Student registration stays a once-off total.
-- New grade, programme, and course fees can store a price per period
-- and a discount for settling the year. Existing rows keep amount as the
-- charge total because priceIsPerPeriod defaults to false.

ALTER TABLE "fee_structures"
ADD COLUMN "priceIsPerPeriod" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "yearlyDiscountPercent" DECIMAL(5,2),
ADD COLUMN "invoiceYearly" BOOLEAN NOT NULL DEFAULT false;
