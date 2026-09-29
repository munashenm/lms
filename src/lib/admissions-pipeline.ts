import type { ApplicationStatusValue } from "./application-status";

/** Ordered admissions pipeline stages for the kanban / board view. */
export const ADMISSIONS_PIPELINE_STAGES: ApplicationStatusValue[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_OUTSTANDING",
  "INTERVIEW_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "WAITLISTED",
  "PROVISIONALLY_ACCEPTED",
  "OFFER_ISSUED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "ACCEPTED",
  "ENROLLED",
];

export const ADMISSIONS_TERMINAL_STAGES: ApplicationStatusValue[] = ["REJECTED", "WITHDRAWN"];

export function canIssueOffer(status: string): boolean {
  return [
    "UNDER_REVIEW",
    "DOCUMENTS_OUTSTANDING",
    "INTERVIEW_REQUIRED",
    "ASSESSMENT_REQUIRED",
    "WAITLISTED",
    "PROVISIONALLY_ACCEPTED",
    "ACCEPTED",
  ].includes(status);
}

export function canAcceptOffer(status: string): boolean {
  return (
    status === "OFFER_ISSUED" ||
    status === "PROVISIONALLY_ACCEPTED" ||
    status === "DEPOSIT_PAID"
  );
}

export function canMarkDepositPaid(application: {
  status: string;
  depositAmount?: number | string | null;
  depositPaidAt?: Date | string | null;
  depositWaivedAt?: Date | string | null;
}): boolean {
  if (application.depositPaidAt || application.depositWaivedAt) return false;
  const amount = Number(application.depositAmount ?? 0);
  return (
    amount > 0 &&
    ["OFFER_ISSUED", "DEPOSIT_PENDING", "ACCEPTED", "PROVISIONALLY_ACCEPTED"].includes(
      application.status
    )
  );
}

export function pipelineColumnForStatus(status: string): string {
  if (ADMISSIONS_PIPELINE_STAGES.includes(status as ApplicationStatusValue)) return status;
  if (status === "REJECTED" || status === "WITHDRAWN") return status;
  return "SUBMITTED";
}
