-- Denormalize schoolId onto academic rows so tenant filters do not depend on joins.
-- Column stays nullable so orphan rows are not rewritten or deleted.

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

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

UPDATE timetable_slots t
SET "schoolId" = (SELECT cl."schoolId" FROM classes cl WHERE cl.id = t."classId")
WHERE t."schoolId" IS NULL;

CREATE INDEX IF NOT EXISTS assessments_schoolId_idx ON assessments ("schoolId");
CREATE INDEX IF NOT EXISTS attendance_records_schoolId_date_idx ON attendance_records ("schoolId", date);
CREATE INDEX IF NOT EXISTS timetable_slots_schoolId_idx ON timetable_slots ("schoolId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_schoolId_fkey') THEN
    ALTER TABLE assessments
      ADD CONSTRAINT assessments_schoolId_fkey
      FOREIGN KEY ("schoolId") REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_schoolId_fkey') THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_schoolId_fkey
      FOREIGN KEY ("schoolId") REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_schoolId_fkey') THEN
    ALTER TABLE timetable_slots
      ADD CONSTRAINT timetable_slots_schoolId_fkey
      FOREIGN KEY ("schoolId") REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
END $$;
