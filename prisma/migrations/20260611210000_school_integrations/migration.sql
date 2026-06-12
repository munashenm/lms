-- School integration settings (email, SMS, payment gateways)

CREATE TABLE "school_integration_configs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sendgridEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sendgridApiKey" TEXT,
    "sendgridFromEmail" TEXT,
    "sendgridFromName" TEXT,
    "twilioEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "twilioFromNumber" TEXT,
    "payfastEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payfastMerchantId" TEXT,
    "payfastMerchantKey" TEXT,
    "payfastPassphrase" TEXT,
    "payfastSandbox" BOOLEAN NOT NULL DEFAULT true,
    "ozowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ozowSiteCode" TEXT,
    "ozowPrivateKey" TEXT,
    "ozowSandbox" BOOLEAN NOT NULL DEFAULT true,
    "yocoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "yocoSecretKey" TEXT,
    "yocoWebhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_integration_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_integration_configs_schoolId_key" ON "school_integration_configs"("schoolId");

ALTER TABLE "school_integration_configs" ADD CONSTRAINT "school_integration_configs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
