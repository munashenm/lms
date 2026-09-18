-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYSTACK';

-- Paystack settings replace unused PayPal integration fields
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paystackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paystackSecretKey" TEXT;
ALTER TABLE "school_integration_configs" ADD COLUMN IF NOT EXISTS "paystackPublicKey" TEXT;

ALTER TABLE "school_integration_configs" DROP COLUMN IF EXISTS "paypalEnabled";
ALTER TABLE "school_integration_configs" DROP COLUMN IF EXISTS "paypalClientId";
ALTER TABLE "school_integration_configs" DROP COLUMN IF EXISTS "paypalSecret";
ALTER TABLE "school_integration_configs" DROP COLUMN IF EXISTS "paypalSandbox";
ALTER TABLE "school_integration_configs" DROP COLUMN IF EXISTS "paypalCurrency";
