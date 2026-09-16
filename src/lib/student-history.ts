import { prisma } from "@/lib/db";

const TRACKED_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "preferredName",
  "dateOfBirth",
  "gender",
  "nationality",
  "homeLanguage",
  "saIdNumber",
  "passportNumber",
  "alternativeId",
  "email",
  "phone",
  "address",
  "city",
  "province",
  "postalCode",
  "postalAddress",
  "campusId",
  "status",
  "studentNumber",
  "enrolledAt",
  "medicalNotes",
  "emergencyName",
  "emergencyPhone",
  "emergencyRelationship",
  "notes",
] as const;

function stringify(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function recordStudentChanges(params: {
  schoolId: string;
  studentId: string;
  userId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const rows = TRACKED_FIELDS.flatMap((field) => {
    const oldValue = stringify(params.before[field]);
    const newValue = stringify(params.after[field]);
    if (oldValue === newValue) return [];
    return [
      {
        schoolId: params.schoolId,
        studentId: params.studentId,
        userId: params.userId,
        field,
        oldValue,
        newValue,
      },
    ];
  });
  if (!rows.length) return;
  await prisma.studentChangeLog.createMany({ data: rows });
}
