/** EMIS / LURITS / CEMIS readiness fields expected for SA school submissions. */

export const POPULATION_GROUPS = [
  "AFRICAN",
  "COLOURED",
  "INDIAN",
  "WHITE",
  "OTHER",
  "UNSPECIFIED",
] as const;

export type PopulationGroupValue = (typeof POPULATION_GROUPS)[number];

export const POPULATION_GROUP_LABELS: Record<PopulationGroupValue, string> = {
  AFRICAN: "African",
  COLOURED: "Coloured",
  INDIAN: "Indian/Asian",
  WHITE: "White",
  OTHER: "Other",
  UNSPECIFIED: "Unspecified",
};

export type EmisLearnerInput = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  status: string;
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
  gradeName?: string | null;
  className?: string | null;
};

export type EmisEducatorInput = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  saIdNumber?: string | null;
  gender?: string | null;
  luritsNumber?: string | null;
  persalNumber?: string | null;
};

export type ComplianceIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  entityType: "learner" | "educator" | "school";
  entityId: string;
  field?: string;
};

export function checkLearnerEmis(learner: EmisLearnerInput): ComplianceIssue[] {
  if (learner.status !== "ACTIVE") return [];
  const issues: ComplianceIssue[] = [];
  const base = {
    entityType: "learner" as const,
    entityId: learner.id,
  };

  if (!learner.gender) {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_GENDER",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is missing gender.`,
      field: "gender",
    });
  }
  if (!learner.populationGroup || learner.populationGroup === "UNSPECIFIED") {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_POPULATION_GROUP",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is missing population group (required for LURITS/CEMIS).`,
      field: "populationGroup",
    });
  }
  if (!learner.dateOfBirth) {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_DOB",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is missing date of birth.`,
      field: "dateOfBirth",
    });
  }
  if (!learner.saIdNumber && !learner.passportNumber) {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_IDENTITY",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) needs an SA ID or passport number.`,
      field: "saIdNumber",
    });
  }
  if (!learner.homeLanguage) {
    issues.push({
      ...base,
      severity: "WARNING",
      code: "MISSING_HOME_LANGUAGE",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is missing home language.`,
      field: "homeLanguage",
    });
  }
  if (!learner.citizenship) {
    issues.push({
      ...base,
      severity: "WARNING",
      code: "MISSING_CITIZENSHIP",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is missing citizenship.`,
      field: "citizenship",
    });
  }
  if (!learner.gradeName) {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_GRADE",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) is not linked to a grade.`,
      field: "grade",
    });
  }
  if (!learner.luritsNumber) {
    issues.push({
      ...base,
      severity: "WARNING",
      code: "MISSING_LURITS",
      message: `${learner.firstName} ${learner.lastName} (${learner.studentNumber}) has no LURITS number yet (import feedback after district submission).`,
      field: "luritsNumber",
    });
  }
  return issues;
}

export function checkEducatorEmis(educator: EmisEducatorInput): ComplianceIssue[] {
  if (educator.status !== "ACTIVE") return [];
  const issues: ComplianceIssue[] = [];
  const base = {
    entityType: "educator" as const,
    entityId: educator.id,
  };
  if (!educator.saIdNumber) {
    issues.push({
      ...base,
      severity: "ERROR",
      code: "MISSING_EDUCATOR_ID",
      message: `${educator.firstName} ${educator.lastName} (${educator.employeeNumber}) is missing SA ID.`,
      field: "saIdNumber",
    });
  }
  if (!educator.luritsNumber) {
    issues.push({
      ...base,
      severity: "WARNING",
      code: "MISSING_EDUCATOR_LURITS",
      message: `${educator.firstName} ${educator.lastName} (${educator.employeeNumber}) has no LURITS number yet.`,
      field: "luritsNumber",
    });
  }
  return issues;
}

export function summariseCompliance(issues: ComplianceIssue[]) {
  const errors = issues.filter((i) => i.severity === "ERROR");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const learnerIds = new Set(issues.filter((i) => i.entityType === "learner").map((i) => i.entityId));
  const educatorIds = new Set(issues.filter((i) => i.entityType === "educator").map((i) => i.entityId));
  return {
    errorCount: errors.length,
    warningCount: warnings.length,
    blocking: errors.length > 0,
    affectedLearners: learnerIds.size,
    affectedEducators: educatorIds.size,
    readyForExport: errors.length === 0,
  };
}