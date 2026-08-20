-- AlterTable
ALTER TABLE "schools" ADD COLUMN "heroHeadline" TEXT;
ALTER TABLE "schools" ADD COLUMN "heroSubtitle" TEXT;
ALTER TABLE "schools" ADD COLUMN "aboutText" TEXT;
ALTER TABLE "schools" ADD COLUMN "missionText" TEXT;
ALTER TABLE "schools" ADD COLUMN "admissionsText" TEXT;

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ExamQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "school_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "ExamQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "options" JSONB,
    "correctAnswer" TEXT,
    "points" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsAwarded" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_events_schoolId_startsAt_idx" ON "school_events"("schoolId", "startsAt");

-- CreateIndex
CREATE INDEX "exam_questions_assessmentId_idx" ON "exam_questions"("assessmentId");

-- CreateIndex
CREATE INDEX "exam_attempts_studentId_idx" ON "exam_attempts"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_assessmentId_studentId_key" ON "exam_attempts"("assessmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_attemptId_questionId_key" ON "exam_answers"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
