import {
  AcademicPeriodStatus,
  AcademicSessionStatus,
  type AcademicYear,
} from "@prisma/client";

export const VIEW_SESSION_COOKIE = "schoolhub_academic_session";

export const SESSION_STATUS_LABELS: Record<AcademicSessionStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export const PERIOD_STATUS_LABELS: Record<AcademicPeriodStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

export type SessionOption = Pick<
  AcademicYear,
  "id" | "name" | "status" | "isCurrent" | "startDate" | "endDate"
>;

export function parseDateInput(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
