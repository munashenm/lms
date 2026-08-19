-- CreateEnum
CREATE TYPE "VisitorIdentityType" AS ENUM ('SA_ID', 'PASSPORT', 'DRIVERS_LICENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitorHostKind" AS ENUM ('STAFF', 'LEARNER', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitorPurpose" AS ENUM ('PARENT_GUARDIAN', 'ENROLMENT', 'DELIVERY', 'CONTRACTOR', 'OFFICIAL', 'SPORTS_CULTURE', 'MEETING', 'OTHER');

-- CreateTable
CREATE TABLE "visitor_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "campusId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "organisation" TEXT,
    "phone" TEXT,
    "identityType" "VisitorIdentityType",
    "identityNumber" TEXT,
    "hostKind" "VisitorHostKind" NOT NULL,
    "hostName" TEXT NOT NULL,
    "purpose" "VisitorPurpose" NOT NULL,
    "purposeDetail" TEXT,
    "vehicleRegistration" TEXT,
    "badgeNumber" TEXT,
    "notes" TEXT,
    "signedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedOutAt" TIMESTAMP(3),
    "signedInById" TEXT NOT NULL,
    "signedOutById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitor_entries_schoolId_signedOutAt_idx" ON "visitor_entries"("schoolId", "signedOutAt");

-- CreateIndex
CREATE INDEX "visitor_entries_schoolId_signedInAt_idx" ON "visitor_entries"("schoolId", "signedInAt");

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_signedInById_fkey" FOREIGN KEY ("signedInById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_signedOutById_fkey" FOREIGN KEY ("signedOutById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
