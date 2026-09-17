-- Prevent duplicate enrolments without blocking TVET multi-course rows.
-- Skip the index if existing duplicates are present so production data is not rewritten.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM enrolments
    WHERE "courseId" IS NULL
    GROUP BY "studentId", "academicYearId"
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS enrolments_student_year_no_course_uidx
      ON enrolments ("studentId", "academicYearId")
      WHERE "courseId" IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM enrolments
    WHERE "courseId" IS NOT NULL
    GROUP BY "studentId", "academicYearId", "courseId"
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS enrolments_student_year_course_uidx
      ON enrolments ("studentId", "academicYearId", "courseId")
      WHERE "courseId" IS NOT NULL;
  END IF;
END $$;
