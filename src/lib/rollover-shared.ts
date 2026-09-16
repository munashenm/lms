export type RolloverOutcome =
  | "PROMOTED"
  | "REPEATED"
  | "PROGRESSED"
  | "GRADUATED"
  | "WITHDRAWN"
  | "TRANSFERRED"
  | "COMPLETED"
  | "DEFERRED";

export const ROLLOVER_OUTCOME_LABELS: Record<RolloverOutcome, string> = {
  PROMOTED: "Promoted",
  REPEATED: "Repeat",
  PROGRESSED: "Progressed",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
  TRANSFERRED: "Transferred",
  COMPLETED: "Completed programme",
  DEFERRED: "Deferred",
};
