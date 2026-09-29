/**
 * Build a tabular SA-SAMS-ready export package.
 * Schools deploy via SA-SAMS / Valistractor — SchoolHub does not replace DBE filing tools.
 */

export type SasamsLearnerRow = {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  saIdNumber: string;
  passportNumber: string;
  dateOfBirth: string;
  gender: string;
  populationGroup: string;
  citizenship: string;
  homeLanguage: string;
  preferredLanguage: string;
  disability: string;
  sne: string;
  luritsNumber: string;
  grade: string;
  className: string;
  status: string;
  previousEmisSchool: string;
  transferReason: string;
};

export type SasamsEducatorRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  saIdNumber: string;
  luritsNumber: string;
  persalNumber: string;
  department: string;
  status: string;
};

export type SasamsGuardianRow = {
  learnerAdmissionNumber: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email: string;
  saIdNumber: string;
  isPrimary: string;
};

export type SasamsExportPackage = {
  generatedAt: string;
  school: {
    name: string;
    registrationNo: string;
    province: string;
    emisHint: string;
  };
  learners: SasamsLearnerRow[];
  educators: SasamsEducatorRow[];
  guardians: SasamsGuardianRow[];
  notes: string[];
};

function isoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function yn(value: boolean | null | undefined): string {
  return value ? "Y" : "N";
}

export function buildSasamsExportPackage(input: {
  school: {
    name: string;
    registrationNo?: string | null;
    province?: string | null;
  };
  learners: Array<{
    studentNumber: string;
    firstName: string;
    lastName: string;
    saIdNumber?: string | null;
    passportNumber?: string | null;
    dateOfBirth?: Date | string | null;
    gender?: string | null;
    populationGroup?: string | null;
    citizenship?: string | null;
    homeLanguage?: string | null;
    preferredLanguage?: string | null;
    disabilityStatus?: boolean | null;
    sneStatus?: boolean | null;
    luritsNumber?: string | null;
    status: string;
    previousEmisSchool?: string | null;
    transferReason?: string | null;
    gradeName?: string | null;
    className?: string | null;
    guardians?: Array<{
      firstName: string;
      lastName: string;
      relationship?: string | null;
      phone?: string | null;
      email?: string | null;
      saIdNumber?: string | null;
      isPrimary?: boolean;
    }>;
  }>;
  educators: Array<{
    employeeNumber: string;
    firstName: string;
    lastName: string;
    saIdNumber?: string | null;
    luritsNumber?: string | null;
    persalNumber?: string | null;
    department?: string | null;
    status: string;
  }>;
  generatedAt?: Date;
}): SasamsExportPackage {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const learners: SasamsLearnerRow[] = [];
  const guardians: SasamsGuardianRow[] = [];

  for (const learner of input.learners) {
    learners.push({
      admissionNumber: learner.studentNumber,
      firstName: learner.firstName,
      lastName: learner.lastName,
      saIdNumber: learner.saIdNumber ?? "",
      passportNumber: learner.passportNumber ?? "",
      dateOfBirth: isoDate(learner.dateOfBirth),
      gender: learner.gender ?? "",
      populationGroup: learner.populationGroup ?? "",
      citizenship: learner.citizenship ?? "",
      homeLanguage: learner.homeLanguage ?? "",
      preferredLanguage: learner.preferredLanguage ?? "",
      disability: yn(learner.disabilityStatus),
      sne: yn(learner.sneStatus),
      luritsNumber: learner.luritsNumber ?? "",
      grade: learner.gradeName ?? "",
      className: learner.className ?? "",
      status: learner.status,
      previousEmisSchool: learner.previousEmisSchool ?? "",
      transferReason: learner.transferReason ?? "",
    });
    for (const g of learner.guardians ?? []) {
      guardians.push({
        learnerAdmissionNumber: learner.studentNumber,
        firstName: g.firstName,
        lastName: g.lastName,
        relationship: g.relationship ?? "",
        phone: g.phone ?? "",
        email: g.email ?? "",
        saIdNumber: g.saIdNumber ?? "",
        isPrimary: yn(g.isPrimary),
      });
    }
  }

  return {
    generatedAt,
    school: {
      name: input.school.name,
      registrationNo: input.school.registrationNo ?? "",
      province: input.school.province ?? "",
      emisHint: "Deploy this package into SA-SAMS, then submit via your district / Valistractor process.",
    },
    learners,
    educators: input.educators.map((e) => ({
      employeeNumber: e.employeeNumber,
      firstName: e.firstName,
      lastName: e.lastName,
      saIdNumber: e.saIdNumber ?? "",
      luritsNumber: e.luritsNumber ?? "",
      persalNumber: e.persalNumber ?? "",
      department: e.department ?? "",
      status: e.status,
    })),
    guardians,
    notes: [
      "SchoolHub is the operational system of record.",
      "SA-SAMS and Valistractor remain DBE tools for district filing.",
      "Resolve Compliance Centre errors before exporting.",
    ],
  };
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, string>>): string {
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function packageToCsvBundle(pkg: SasamsExportPackage): Record<string, string> {
  return {
    "learners.csv": rowsToCsv(
      [
        "admissionNumber",
        "firstName",
        "lastName",
        "saIdNumber",
        "passportNumber",
        "dateOfBirth",
        "gender",
        "populationGroup",
        "citizenship",
        "homeLanguage",
        "preferredLanguage",
        "disability",
        "sne",
        "luritsNumber",
        "grade",
        "className",
        "status",
        "previousEmisSchool",
        "transferReason",
      ],
      pkg.learners
    ),
    "educators.csv": rowsToCsv(
      [
        "employeeNumber",
        "firstName",
        "lastName",
        "saIdNumber",
        "luritsNumber",
        "persalNumber",
        "department",
        "status",
      ],
      pkg.educators
    ),
    "guardians.csv": rowsToCsv(
      [
        "learnerAdmissionNumber",
        "firstName",
        "lastName",
        "relationship",
        "phone",
        "email",
        "saIdNumber",
        "isPrimary",
      ],
      pkg.guardians
    ),
    "manifest.json": JSON.stringify(
      {
        generatedAt: pkg.generatedAt,
        school: pkg.school,
        counts: {
          learners: pkg.learners.length,
          educators: pkg.educators.length,
          guardians: pkg.guardians.length,
        },
        notes: pkg.notes,
      },
      null,
      2
    ),
  };
}