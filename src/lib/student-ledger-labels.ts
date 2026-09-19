export const STUDENT_LEDGER_TYPE_LABELS = {
  CHARGE: "Charge",
  PAYMENT: "Payment",
  CREDIT: "Credit",
  DISCOUNT: "Discount",
  BURSARY: "Bursary",
  SPONSORSHIP: "Sponsorship",
  ADJUSTMENT: "Adjustment",
  REFUND: "Refund",
} as const;

export type StudentLedgerTypeLabel = keyof typeof STUDENT_LEDGER_TYPE_LABELS;
