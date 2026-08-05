export type RolloverOutcome =
  | "PROMOTED"
  | "REPEATED"
  | "GRADUATED"
  | "WITHDRAWN"
  | "TRANSFERRED"
  | "COMPLETED";

export const ROLLOVER_OUTCOME_LABELS: Record<RolloverOutcome, string> = {
  PROMOTED: "Promoted",
  REPEATED: "Repeat",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
  TRANSFERRED: "Transferred",
  COMPLETED: "Completed programme",
};
