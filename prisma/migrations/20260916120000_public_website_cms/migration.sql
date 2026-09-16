-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DOCUMENTS_OUTSTANDING';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW_REQUIRED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ASSESSMENT_REQUIRED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'PROVISIONALLY_ACCEPTED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ENROLLED';

-- AlterTable schools
ALTER TABLE "schools" ADD COLUMN "visionText" TEXT;
ALTER TABLE "schools" ADD COLUMN "valuesText" TEXT;
ALTER TABLE "schools" ADD COLUMN "principalName" TEXT;
ALTER TABLE "schools" ADD COLUMN "principalTitle" TEXT;
ALTER TABLE "schools" ADD COLUMN "principalMessage" TEXT;
ALTER TABLE "schools" ADD COLUMN "applicationInstructions" TEXT;
ALTER TABLE "schools" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "heroImageUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "schools" ADD COLUMN "officeHours" TEXT;
ALTER TABLE "schools" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "twitterUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "schools" ADD COLUMN "whyChooseUs" JSONB;
ALTER TABLE "schools" ADD COLUMN "applicationsOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN "applicationsOpenFrom" TIMESTAMP(3);
ALTER TABLE "schools" ADD COLUMN "applicationsOpenUntil" TIMESTAMP(3);
ALTER TABLE "schools" ADD COLUMN "admissionYearId" TEXT;
ALTER TABLE "schools" ADD COLUMN "requiredApplicationDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "schools" ADD COLUMN "publishPublicStats" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable grades / courses
ALTER TABLE "grades" ADD COLUMN "openForApplications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "courses" ADD COLUMN "openForApplications" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable applications
ALTER TABLE "applications" ADD COLUMN "academicYearId" TEXT;
ALTER TABLE "applications" ADD COLUMN "campusId" TEXT;
ALTER TABLE "applications" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "applications" ADD COLUMN "gender" "Gender";
ALTER TABLE "applications" ADD COLUMN "nationality" TEXT;
ALTER TABLE "applications" ADD COLUMN "address" TEXT;
ALTER TABLE "applications" ADD COLUMN "city" TEXT;
ALTER TABLE "applications" ADD COLUMN "province" TEXT;
ALTER TABLE "applications" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "applications" ADD COLUMN "previousSchool" TEXT;
ALTER TABLE "applications" ADD COLUMN "previousGrade" TEXT;
ALTER TABLE "applications" ADD COLUMN "additionalInfo" TEXT;
ALTER TABLE "applications" ADD COLUMN "popiaAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "application_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "website_faqs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_faqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "website_gallery_items" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_gallery_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "schools_admissionYearId_idx" ON "schools"("admissionYearId");
CREATE INDEX "applications_academicYearId_idx" ON "applications"("academicYearId");
CREATE INDEX "applications_campusId_idx" ON "applications"("campusId");
CREATE INDEX "application_documents_applicationId_idx" ON "application_documents"("applicationId");
CREATE INDEX "website_faqs_schoolId_sortOrder_idx" ON "website_faqs"("schoolId", "sortOrder");
CREATE INDEX "website_gallery_items_schoolId_sortOrder_idx" ON "website_gallery_items"("schoolId", "sortOrder");

ALTER TABLE "schools" ADD CONSTRAINT "schools_admissionYearId_fkey" FOREIGN KEY ("admissionYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "website_faqs" ADD CONSTRAINT "website_faqs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "website_gallery_items" ADD CONSTRAINT "website_gallery_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
