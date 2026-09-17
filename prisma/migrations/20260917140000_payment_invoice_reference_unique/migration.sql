-- Prevent duplicate gateway/manual receipts for the same invoice reference.
-- Skip the index if existing duplicates are present so production data is not rewritten.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM payments
    WHERE reference IS NOT NULL AND "reversedAt" IS NULL
    GROUP BY "invoiceId", reference
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS payments_invoice_reference_live_uidx
      ON payments ("invoiceId", reference)
      WHERE reference IS NOT NULL AND "reversedAt" IS NULL;
  END IF;
END $$;
