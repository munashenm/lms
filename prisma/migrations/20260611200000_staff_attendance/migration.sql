-- Staff attendance tracking

CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'REMOTE');

CREATE TABLE "staff_attendance_records" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkIn" TEXT,
    "checkOut" TEXT,
    "notes" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_attendance_records_userId_date_key" ON "staff_attendance_records"("userId", "date");
CREATE INDEX "staff_attendance_records_schoolId_date_idx" ON "staff_attendance_records"("schoolId", "date");

ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
