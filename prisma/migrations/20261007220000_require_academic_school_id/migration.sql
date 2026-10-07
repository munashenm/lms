-- Backfill nullable schoolId on academic rows, then enforce NOT NULL.
-- Fails the migration if ownership cannot be determined (no arbitrary school assignment).

UPDATE attendance_records a
SET "schoolId" = COALESCE(
  (SELECT st."schoolId" FROM students st WHERE st.id = a."studentId"),
  (SELECT cl."schoolId" FROM classes cl WHERE cl.id = a."classId"),
  (SELECT s."schoolId" FROM subjects s WHERE s.id = a."subjectId"),
  (
    SELECT c."schoolId"
    FROM modules m
    JOIN courses c ON c.id = m."courseId"
    WHERE m.id = a."moduleId"
  )
)
WHERE a."schoolId" IS NULL;

UPDATE assessments a
SET "schoolId" = COALESCE(
  (SELECT s."schoolId" FROM subjects s WHERE s.id = a."subjectId"),
  (
    SELECT c."schoolId"
    FROM modules m
    JOIN courses c ON c.id = m."courseId"
    WHERE m.id = a."moduleId"
  ),
  (SELECT t."schoolId" FROM teachers t WHERE t.id = a."teacherId")
)
WHERE a."schoolId" IS NULL;

UPDATE timetable_slots t
SET "schoolId" = (SELECT cl."schoolId" FROM classes cl WHERE cl.id = t."classId")
WHERE t."schoolId" IS NULL;

DO $$
DECLARE
  orphan_attendance INTEGER;
  orphan_assessment INTEGER;
  orphan_timetable INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_attendance FROM attendance_records WHERE "schoolId" IS NULL;
  SELECT COUNT(*) INTO orphan_assessment FROM assessments WHERE "schoolId" IS NULL;
  SELECT COUNT(*) INTO orphan_timetable FROM timetable_slots WHERE "schoolId" IS NULL;

  IF orphan_attendance > 0 OR orphan_assessment > 0 OR orphan_timetable > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce NOT NULL schoolId: % attendance, % assessment, % timetable rows have undetermined ownership',
      orphan_attendance, orphan_assessment, orphan_timetable;
  END IF;
END $$;

ALTER TABLE attendance_records ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE assessments ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE timetable_slots ALTER COLUMN "schoolId" SET NOT NULL;
