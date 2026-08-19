-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LicenseCheckResult" AS ENUM ('VALID', 'GRACE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'INVALID_SIGNATURE', 'SERVER_UNAVAILABLE', 'OFFLINE_CACHE', 'RESTRICTED', 'ACTIVATED', 'UPDATED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('CLOUD_SCHEDULED', 'CLOUD_MANUAL', 'OFFLINE', 'PRE_RESTORE');

-- CreateEnum
CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'VERIFYING', 'VERIFIED', 'DELETED');

-- CreateEnum
CREATE TYPE "BackupScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RestoreJobStatus" AS ENUM ('UPLOADING', 'VALIDATING', 'READY', 'RESTORING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'ANALYSING', 'ANALYSED', 'VALIDATING', 'VALIDATED', 'MAPPING', 'MAPPED', 'DETECTING_DUPLICATES', 'PREVIEW', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportIssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFORMATION');

-- CreateEnum
CREATE TYPE "DuplicateAction" AS ENUM ('SKIP', 'UPDATE_EXISTING', 'CREATE_NEW', 'REVIEW_MANUALLY');

-- CreateTable
CREATE TABLE "school_licenses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT 'lms',
    "productName" TEXT NOT NULL DEFAULT 'SchoolHub SA LMS',
    "planCode" TEXT,
    "planName" TEXT,
    "licenseKey" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "issuedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 14,
    "maxLearners" INTEGER,
    "maxEducators" INTEGER,
    "maxAdministrators" INTEGER,
    "maxCampuses" INTEGER,
    "storageLimitBytes" BIGINT,
    "featuresJson" JSONB NOT NULL DEFAULT '{}',
    "signedPayload" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "nextVerificationAt" TIMESTAMP(3),
    "lastCheckError" TEXT,
    "offlineSince" TIMESTAMP(3),
    "installationId" TEXT,
    "registeredDomain" TEXT,
    "stagingDomain" TEXT,
    "serverInstanceId" TEXT,
    "customerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_features" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_checks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "licenseId" TEXT,
    "result" "LicenseCheckResult" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "license_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_installations" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "hostname" TEXT,
    "registeredDomain" TEXT,
    "stagingDomain" TEXT,
    "serverInstanceId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_plans" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultLimits" JSONB NOT NULL DEFAULT '{}',
    "defaultFeatures" JSONB NOT NULL DEFAULT '{}',
    "defaultGraceDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_licenses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT NOT NULL,
    "planId" TEXT,
    "licenseKey" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "status" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 14,
    "limitsJson" JSONB NOT NULL DEFAULT '{}',
    "featuresJson" JSONB NOT NULL DEFAULT '{}',
    "domainsJson" JSONB NOT NULL DEFAULT '[]',
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issued_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_activations" (
    "id" TEXT NOT NULL,
    "issuedLicenseId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "domain" TEXT,
    "serverInstanceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_server_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "licenseKey" TEXT,
    "actor" TEXT,
    "result" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_server_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "frequency" "BackupScheduleFrequency" NOT NULL,
    "retainCount" INTEGER NOT NULL DEFAULT 14,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "BackupType" NOT NULL,
    "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "applicationVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT,
    "filename" TEXT,
    "errorMessage" TEXT,
    "learnerCount" INTEGER NOT NULL DEFAULT 0,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_files" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "backupJobId" TEXT,
    "sourceType" TEXT NOT NULL,
    "status" "RestoreJobStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdById" TEXT,
    "preRestoreBackupId" TEXT,
    "errorMessage" TEXT,
    "validationReport" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restore_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL DEFAULT 'sa-sams',
    "adapterId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "encryptedStorageKey" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdById" TEXT,
    "analysedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "summary" JSONB,
    "mappingId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'IMPORTING',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_staging_records" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceRow" INTEGER,
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "issues" JSONB,
    "duplicateOfId" TEXT,
    "duplicateAction" "DuplicateAction" NOT NULL DEFAULT 'REVIEW_MANUALLY',
    "importedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_staging_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stagingRecordId" TEXT,
    "severity" "ImportIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_field_mappings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL DEFAULT 'sa-sams',
    "adapterVersion" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_record_mappings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "localEntityId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT,

    CONSTRAINT "external_record_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_licenses_schoolId_key" ON "school_licenses"("schoolId");
CREATE INDEX "school_licenses_licenseKey_idx" ON "school_licenses"("licenseKey");
CREATE INDEX "school_licenses_status_idx" ON "school_licenses"("status");

CREATE UNIQUE INDEX "license_features_licenseId_featureKey_key" ON "license_features"("licenseId", "featureKey");
CREATE INDEX "license_features_featureKey_idx" ON "license_features"("featureKey");

CREATE INDEX "license_checks_schoolId_checkedAt_idx" ON "license_checks"("schoolId", "checkedAt");
CREATE INDEX "license_checks_licenseId_checkedAt_idx" ON "license_checks"("licenseId", "checkedAt");

CREATE UNIQUE INDEX "license_installations_installationId_key" ON "license_installations"("installationId");
CREATE UNIQUE INDEX "license_installations_schoolId_key" ON "license_installations"("schoolId");
CREATE INDEX "license_installations_schoolId_idx" ON "license_installations"("schoolId");

CREATE UNIQUE INDEX "license_products_code_key" ON "license_products"("code");
CREATE UNIQUE INDEX "license_plans_productId_code_key" ON "license_plans"("productId", "code");
CREATE UNIQUE INDEX "issued_licenses_licenseKey_key" ON "issued_licenses"("licenseKey");
CREATE INDEX "issued_licenses_institutionId_idx" ON "issued_licenses"("institutionId");
CREATE INDEX "issued_licenses_status_idx" ON "issued_licenses"("status");
CREATE UNIQUE INDEX "license_activations_issuedLicenseId_installationId_key" ON "license_activations"("issuedLicenseId", "installationId");
CREATE INDEX "license_activations_installationId_idx" ON "license_activations"("installationId");
CREATE INDEX "license_server_audits_createdAt_idx" ON "license_server_audits"("createdAt");
CREATE INDEX "license_server_audits_licenseKey_idx" ON "license_server_audits"("licenseKey");

CREATE UNIQUE INDEX "backup_schedules_schoolId_frequency_key" ON "backup_schedules"("schoolId", "frequency");
CREATE INDEX "backup_schedules_enabled_nextRunAt_idx" ON "backup_schedules"("enabled", "nextRunAt");
CREATE INDEX "backup_jobs_schoolId_createdAt_idx" ON "backup_jobs"("schoolId", "createdAt");
CREATE INDEX "backup_jobs_schoolId_status_idx" ON "backup_jobs"("schoolId", "status");
CREATE INDEX "backup_files_jobId_idx" ON "backup_files"("jobId");
CREATE INDEX "restore_jobs_schoolId_createdAt_idx" ON "restore_jobs"("schoolId", "createdAt");
CREATE INDEX "restore_jobs_schoolId_status_idx" ON "restore_jobs"("schoolId", "status");

CREATE UNIQUE INDEX "integration_providers_schoolId_code_key" ON "integration_providers"("schoolId", "code");
CREATE INDEX "integration_providers_code_idx" ON "integration_providers"("code");
CREATE INDEX "import_jobs_schoolId_createdAt_idx" ON "import_jobs"("schoolId", "createdAt");
CREATE INDEX "import_jobs_schoolId_status_idx" ON "import_jobs"("schoolId", "status");
CREATE INDEX "import_batches_schoolId_createdAt_idx" ON "import_batches"("schoolId", "createdAt");
CREATE INDEX "import_batches_jobId_idx" ON "import_batches"("jobId");
CREATE INDEX "import_staging_records_jobId_entityType_idx" ON "import_staging_records"("jobId", "entityType");
CREATE INDEX "import_staging_records_jobId_validationStatus_idx" ON "import_staging_records"("jobId", "validationStatus");
CREATE INDEX "import_errors_jobId_severity_idx" ON "import_errors"("jobId", "severity");
CREATE INDEX "import_field_mappings_schoolId_providerCode_idx" ON "import_field_mappings"("schoolId", "providerCode");
CREATE UNIQUE INDEX "external_record_mappings_schoolId_sourceSystem_entityType_sourceRecordId_key" ON "external_record_mappings"("schoolId", "sourceSystem", "entityType", "sourceRecordId");
CREATE INDEX "external_record_mappings_schoolId_localEntityId_idx" ON "external_record_mappings"("schoolId", "localEntityId");
CREATE INDEX "external_record_mappings_importBatchId_idx" ON "external_record_mappings"("importBatchId");

-- AddForeignKey
ALTER TABLE "school_licenses" ADD CONSTRAINT "school_licenses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_features" ADD CONSTRAINT "license_features_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "school_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_checks" ADD CONSTRAINT "license_checks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_checks" ADD CONSTRAINT "license_checks_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "school_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "license_installations" ADD CONSTRAINT "license_installations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_plans" ADD CONSTRAINT "license_plans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "license_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "license_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_productId_fkey" FOREIGN KEY ("productId") REFERENCES "license_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_planId_fkey" FOREIGN KEY ("planId") REFERENCES "license_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_issuedLicenseId_fkey" FOREIGN KEY ("issuedLicenseId") REFERENCES "issued_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backup_schedules" ADD CONSTRAINT "backup_schedules_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backup_files" ADD CONSTRAINT "backup_files_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "backup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "backup_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_preRestoreBackupId_fkey" FOREIGN KEY ("preRestoreBackupId") REFERENCES "backup_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_providers" ADD CONSTRAINT "integration_providers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "import_field_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_staging_records" ADD CONSTRAINT "import_staging_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_stagingRecordId_fkey" FOREIGN KEY ("stagingRecordId") REFERENCES "import_staging_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_field_mappings" ADD CONSTRAINT "import_field_mappings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_record_mappings" ADD CONSTRAINT "external_record_mappings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_record_mappings" ADD CONSTRAINT "external_record_mappings_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
