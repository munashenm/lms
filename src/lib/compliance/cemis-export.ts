/**
 * Western Cape CEMIS-oriented marks export (MVP).
 * Produces a tabular pack districts can map into CEMIS — not a proprietary CEMIS client.
 */

export type CemisMarkRow = {
  admissionNumber: string;
  luritsNumber: string;
  firstName: string;
  lastName: string;
  grade: string;
  className: string;
  subjectCode: string;
  subjectName: string;
  assessmentTitle: string;
  term: string;
  score: string;
  maxMarks: string;
  gradeSymbol: string;
  recordedAt: string;
};

export function buildCemisMarksPackage(input: {
  school: { name: string; province?: string | null; registrationNo?: string | null };
  academicYear?: string | null;
  term?: string | null;
  rows: Array<{
    studentNumber: string;
    luritsNumber?: string | null;
    firstName: string;
    lastName: string;
    gradeName?: string | null;
    className?: string | null;
    subjectCode?: string | null;
    subjectName?: string | null;
    assessmentTitle: string;
    termName?: string | null;
    score: number | string;
    maxMarks?: number | string | null;
    gradeSymbol?: string | null;
    recordedAt?: Date | string | null;
  }>;
  generatedAt?: Date;
}) {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const marks: CemisMarkRow[] = input.rows.map((r) => ({
    admissionNumber: r.studentNumber,
    luritsNumber: r.luritsNumber ?? "",
    firstName: r.firstName,
    lastName: r.lastName,
    grade: r.gradeName ?? "",
    className: r.className ?? "",
    subjectCode: r.subjectCode ?? "",
    subjectName: r.subjectName ?? "",
    assessmentTitle: r.assessmentTitle,
    term: r.termName ?? input.term ?? "",
    score: String(r.score),
    maxMarks: r.maxMarks == null ? "" : String(r.maxMarks),
    gradeSymbol: r.gradeSymbol ?? "",
    recordedAt: r.recordedAt
      ? (typeof r.recordedAt === "string" ? r.recordedAt : r.recordedAt.toISOString()).slice(0, 10)
      : "",
  }));

  return {
    generatedAt,
    school: {
      name: input.school.name,
      province: input.school.province ?? "",
      registrationNo: input.school.registrationNo ?? "",
    },
    academicYear: input.academicYear ?? "",
    term: input.term ?? "",
    marks,
    notes: [
      "CEMIS MVP export for Western Cape mark reporting.",
      "Validate subject codes against your district CEMIS templates before upload.",
    ],
  };
}

export function cemisPackageToCsv(pkg: ReturnType<typeof buildCemisMarksPackage>): string {
  const headers = [
    "admissionNumber",
    "luritsNumber",
    "firstName",
    "lastName",
    "grade",
    "className",
    "subjectCode",
    "subjectName",
    "assessmentTitle",
    "term",
    "score",
    "maxMarks",
    "gradeSymbol",
    "recordedAt",
  ];
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  return [
    headers.join(","),
    ...pkg.marks.map((row) => headers.map((h) => escape((row as Record<string, string>)[h] ?? "")).join(",")),
  ].join("\n");
}