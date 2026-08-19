-- AlterTable
ALTER TABLE "schools" ADD COLUMN "teacherReviewsAnonymous" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN "studentLeaveRequiresGuardian" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "timetable_slots" ADD COLUMN "onlineMeetingUrl" TEXT;

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "venue" TEXT;
ALTER TABLE "assessments" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "assessments" ADD COLUMN "availableFrom" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "learnerVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "targetGradeId" TEXT;
ALTER TABLE "documents" ADD COLUMN "targetClassId" TEXT;
ALTER TABLE "documents" ADD COLUMN "targetCampusId" TEXT;
ALTER TABLE "documents" ADD COLUMN "targetCourseId" TEXT;
ALTER TABLE "documents" ADD COLUMN "targetStudentId" TEXT;

-- CreateEnum
CREATE TYPE "StudentAbsenceType" AS ENUM ('SICK', 'FAMILY', 'PERSONAL', 'SCHOOL_ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "CurriculumTopicStatus" AS ENUM ('PLANNED', 'CURRENT', 'COMPLETED');

-- CreateTable
CREATE TABLE "student_absence_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentAbsenceType" NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "documentUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_absence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_reviews" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "teachingQuality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "preparedness" INTEGER NOT NULL,
    "subjectKnowledge" INTEGER NOT NULL,
    "availability" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "comment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "termId" TEXT,
    "weekNumber" INTEGER,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "objective" TEXT,
    "resources" TEXT,
    "readingMaterial" TEXT,
    "relatedAssessmentId" TEXT,
    "lessonDate" DATE NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_topics" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "termId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CurriculumTopicStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_absence_requests_schoolId_status_idx" ON "student_absence_requests"("schoolId", "status");
CREATE INDEX "student_absence_requests_studentId_createdAt_idx" ON "student_absence_requests"("studentId", "createdAt");
CREATE UNIQUE INDEX "teacher_reviews_studentId_teacherId_periodKey_key" ON "teacher_reviews"("studentId", "teacherId", "periodKey");
CREATE INDEX "teacher_reviews_schoolId_teacherId_idx" ON "teacher_reviews"("schoolId", "teacherId");
CREATE INDEX "lesson_plans_schoolId_subjectId_idx" ON "lesson_plans"("schoolId", "subjectId");
CREATE INDEX "lesson_plans_classId_lessonDate_idx" ON "lesson_plans"("classId", "lessonDate");
CREATE INDEX "curriculum_topics_schoolId_subjectId_idx" ON "curriculum_topics"("schoolId", "subjectId");
CREATE INDEX "curriculum_topics_classId_sortOrder_idx" ON "curriculum_topics"("classId", "sortOrder");

-- AddForeignKey
ALTER TABLE "student_absence_requests" ADD CONSTRAINT "student_absence_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_absence_requests" ADD CONSTRAINT "student_absence_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_absence_requests" ADD CONSTRAINT "student_absence_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
