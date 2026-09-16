import type { AcademicYear, InstitutionType, School } from "@prisma/client";
import { isCollegeLike } from "./terminology";

export const DEFAULT_APPLICATION_DOCUMENTS = [
  "ID_DOCUMENT",
  "BIRTH_CERTIFICATE",
  "LATEST_REPORT",
  "PROOF_OF_RESIDENCE",
] as const;

export const APPLICATION_DOCUMENT_LABELS: Record<string, string> = {
  ID_DOCUMENT: "ID / passport",
  BIRTH_CERTIFICATE: "Birth certificate",
  LATEST_REPORT: "Latest report / results",
  PROOF_OF_RESIDENCE: "Proof of residence",
  TRANSFER_LETTER: "Transfer letter",
  CLINIC_CARD: "Clinic card / immunisation",
  QUALIFICATION: "Highest qualification",
  OTHER: "Other supporting document",
};

export const APPLICATION_DOCUMENT_OPTIONS = Object.entries(APPLICATION_DOCUMENT_LABELS).map(
  ([value, label]) => ({ value, label })
);

export type AdmissionSchool = Pick<
  School,
  | "applicationsOpen"
  | "applicationsOpenFrom"
  | "applicationsOpenUntil"
  | "applicationInstructions"
  | "requiredApplicationDocuments"
  | "admissionsText"
> & {
  admissionYear?: Pick<AcademicYear, "id" | "name" | "startDate" | "endDate"> | null;
};

export function admissionYearNumber(
  year?: Pick<AcademicYear, "name" | "startDate"> | null,
  fallbackDate = new Date()
): number {
  const fromName = year?.name?.match(/(\d{4})(?!.*\d{4})/)?.[1];
  if (fromName) return Number(fromName);
  if (year?.startDate) return new Date(year.startDate).getFullYear();
  return fallbackDate.getFullYear();
}

export function admissionYearLabel(
  year?: Pick<AcademicYear, "name"> | null,
  fallbackDate = new Date()
): string {
  const name = year?.name?.trim();
  if (name) return name;
  return String(fallbackDate.getFullYear());
}

export function nextApplicationReference(year: number, sequence: number): string {
  return `APP-${year}-${String(sequence).padStart(5, "0")}`;
}

export function applicationReferencePrefix(year: number): string {
  return `APP-${year}-`;
}

export function isApplicationsOpen(
  school: Pick<School, "applicationsOpen" | "applicationsOpenFrom" | "applicationsOpenUntil">,
  now = new Date()
): { open: boolean; message: string } {
  if (!school.applicationsOpen) {
    return {
      open: false,
      message: "Online applications are currently closed. Please contact the admissions office.",
    };
  }
  if (school.applicationsOpenFrom && now < school.applicationsOpenFrom) {
    return {
      open: false,
      message: `Applications open on ${school.applicationsOpenFrom.toLocaleDateString("en-ZA")}.`,
    };
  }
  if (school.applicationsOpenUntil && now > school.applicationsOpenUntil) {
    return {
      open: false,
      message: `The application closing date was ${school.applicationsOpenUntil.toLocaleDateString("en-ZA")}.`,
    };
  }
  return { open: true, message: "Applications are open." };
}

export function requiredDocumentTypes(school: Pick<School, "requiredApplicationDocuments">): string[] {
  return school.requiredApplicationDocuments.length
    ? school.requiredApplicationDocuments
    : [...DEFAULT_APPLICATION_DOCUMENTS];
}

export function documentLabel(type: string): string {
  return APPLICATION_DOCUMENT_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

export function applyCtaLabel(yearLabel: string): string {
  return `Apply for ${yearLabel}`;
}

export function intakeFieldLabel(type?: InstitutionType | null): string {
  return isCollegeLike(type ?? null) ? "Programme" : "Grade";
}
