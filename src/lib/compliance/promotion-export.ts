/**
 * Promotion decisions → LURITS-style maintenance batch (Tx12-oriented tabular export).
 */

export type PromotionLuritsRow = {
  admissionNumber: string;
  luritsNumber: string;
  firstName: string;
  lastName: string;
  saIdNumber: string;
  fromGrade: string;
  toGrade: string;
  fromYear: string;
  toYear: string;
  outcome: string;
  eligibility: string;
  average: string;
  attendancePercent: string;
  decidedAt: string;
};

export function buildPromotionLuritsPackage(input: {
  school: { name: string; registrationNo?: string | null };
  fromAcademicYear?: string | null;
  rows: Array<{
    studentNumber: string;
    luritsNumber?: string | null;
    firstName: string;
    lastName: string;
    saIdNumber?: string | null;
    fromGradeName?: string | null;
    toGradeName?: string | null;
    fromYearName?: string | null;
    toYearName?: string | null;
    outcome?: string | null;
    eligibility?: string | null;
    average?: number | string | null;
    attendancePercent?: number | string | null;
    createdAt?: Date | string | null;
  }>;
  generatedAt?: Date;
}) {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const promotions: PromotionLuritsRow[] = input.rows.map((r) => ({
    admissionNumber: r.studentNumber,
    luritsNumber: r.luritsNumber ?? "",
    firstName: r.firstName,
    lastName: r.lastName,
    saIdNumber: r.saIdNumber ?? "",
    fromGrade: r.fromGradeName ?? "",
    toGrade: r.toGradeName ?? "",
    fromYear: r.fromYearName ?? input.fromAcademicYear ?? "",
    toYear: r.toYearName ?? "",
    outcome: r.outcome ?? "",
    eligibility: r.eligibility ?? "",
    average: r.average == null ? "" : String(r.average),
    attendancePercent: r.attendancePercent == null ? "" : String(r.attendancePercent),
    decidedAt: r.createdAt
      ? (typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString()).slice(0, 10)
      : "",
  }));

  return {
    generatedAt,
    school: {
      name: input.school.name,
      registrationNo: input.school.registrationNo ?? "",
    },
    fromAcademicYear: input.fromAcademicYear ?? "",
    promotions,
    notes: [
      "Promotion maintenance batch for LURITS / SA-SAMS year-end submission.",
      "Align outcomes with your district promotion codes before filing.",
    ],
  };
}

export function promotionPackageToCsv(pkg: ReturnType<typeof buildPromotionLuritsPackage>): string {
  const headers = [
    "admissionNumber",
    "luritsNumber",
    "firstName",
    "lastName",
    "saIdNumber",
    "fromGrade",
    "toGrade",
    "fromYear",
    "toYear",
    "outcome",
    "eligibility",
    "average",
    "attendancePercent",
    "decidedAt",
  ];
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  return [
    headers.join(","),
    ...pkg.promotions.map((row) =>
      headers.map((h) => escape((row as Record<string, string>)[h] ?? "")).join(",")
    ),
  ].join("\n");
}