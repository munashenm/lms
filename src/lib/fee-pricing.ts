import { fromCents, roundMoney, toCents } from "./money";
import { formatZAR } from "./utils";

export const RECURRING_FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const BILLING_FREQUENCY_LABELS: Record<string, string> = {
  ONCE: "Once-off",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
  TERMLY: "Per term",
  SEMESTER: "Per semester",
  CUSTOM: "Custom",
};

export function chargeSourceLabel(source: string): string {
  switch (source) {
    case "REGISTRATION_FEE":
      return "Registration";
    case "GRADE_FEE":
      return "Grade";
    case "COURSE_FEE":
      return "Programme";
    case "MODULE_FEE":
      return "Course";
    case "CLASS_FEE":
      return "Class";
    case "HOSTEL_FEE":
      return "Hostel";
    case "TRANSPORT_FEE":
      return "Transport";
    case "MANUAL_CHARGE":
      return "Manual";
    default:
      return source;
  }
}

export function periodUnit(frequency: string): string {
  switch (frequency) {
    case "MONTHLY":
      return "month";
    case "QUARTERLY":
      return "quarter";
    case "HALF_YEARLY":
      return "half-year";
    case "SEMESTER":
      return "semester";
    case "TERMLY":
      return "term";
    case "YEARLY":
      return "year";
    default:
      return "period";
  }
}

/** How many billing periods make up one academic year for this frequency. */
export function periodCountFor(frequency: string, termCount = 4): number {
  switch (frequency) {
    case "MONTHLY":
      return 12;
    case "QUARTERLY":
      return 4;
    case "HALF_YEARLY":
    case "SEMESTER":
      return 2;
    case "TERMLY":
      return Math.max(1, termCount);
    default:
      return 1;
  }
}

/**
 * Yearly amount when the stored price is one period.
 * A 10% discount on R1,000 monthly is R10,800 for the year.
 */
export function yearlySettlementAmount(
  periodAmount: number,
  periodCount: number,
  discountPercent?: number | null
): number {
  const periods = Math.max(1, Math.floor(periodCount));
  const grossCents = toCents(periodAmount) * periods;
  const percent = discountPercent == null ? 0 : discountPercent;
  if (!Number.isFinite(percent) || percent <= 0) return fromCents(grossCents);
  const bounded = Math.min(100, percent);
  const discounted = Math.round(grossCents * (1 - bounded / 100));
  return fromCents(Math.max(0, discounted));
}

export function normalizeYearlyDiscount(value: number | null | undefined): number | null | "invalid" {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 100) return "invalid";
  const rounded = roundMoney(value);
  if (rounded > 100) return "invalid";
  if (rounded <= 0) return null;
  return rounded;
}

export interface FeeStructureRuleInput {
  chargeSource: string;
  billingFrequency: string;
  priceIsPerPeriod?: boolean;
  invoiceYearly?: boolean;
  yearlyDiscountPercent?: number | null;
  allowInstalments?: boolean;
  gradeId?: string | null;
  courseId?: string | null;
  moduleId?: string | null;
}

export function feeStructureRuleError(input: FeeStructureRuleInput): string | null {
  const discount = input.yearlyDiscountPercent;
  if (discount != null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
    return "Yearly discount must be between 0 and 100.";
  }

  if (input.chargeSource === "REGISTRATION_FEE") {
    if (input.billingFrequency !== "ONCE") {
      return "Registration is a once-off charge for the whole enrolment.";
    }
    if (input.priceIsPerPeriod) {
      return "Registration is a single amount, not a price per period.";
    }
    if (input.invoiceYearly) {
      return "Registration is already charged once.";
    }
    if (input.allowInstalments) {
      return "Registration is charged once and is not split into instalments.";
    }
    if (discount != null && discount > 0) {
      return "Registration does not use a yearly discount.";
    }
    return null;
  }

  const structured =
    Boolean(input.priceIsPerPeriod) &&
    (input.chargeSource === "GRADE_FEE" ||
      input.chargeSource === "COURSE_FEE" ||
      input.chargeSource === "MODULE_FEE");

  if (!structured) {
    if (discount != null && discount > 0 && !input.priceIsPerPeriod) {
      return "A yearly discount applies only when the amount is a price per period.";
    }
    return null;
  }

  if (!RECURRING_FREQUENCIES.includes(input.billingFrequency as RecurringFrequency)) {
    return "Choose monthly, quarterly, half-yearly, or yearly billing.";
  }

  if (input.chargeSource === "GRADE_FEE") {
    if (!input.gradeId) return "Choose the grade this fee applies to.";
    if (input.courseId || input.moduleId) return "A grade fee cannot also target a programme or course.";
  }
  if (input.chargeSource === "COURSE_FEE") {
    if (!input.courseId) return "Choose the programme this fee applies to.";
    if (input.gradeId || input.moduleId) return "A programme fee cannot also target a grade or course.";
  }
  if (input.chargeSource === "MODULE_FEE") {
    if (!input.moduleId) return "Choose the course this fee applies to.";
    if (input.gradeId || input.courseId) return "A course fee cannot also target a grade or programme.";
  }

  const yearly = input.billingFrequency === "YEARLY";
  if (yearly && discount != null && discount > 0) {
    return "A yearly discount applies when the fee is billed more often than once a year.";
  }
  if (yearly && input.invoiceYearly) {
    return "Yearly billing is already settled once for the year.";
  }
  return null;
}

export function structuredAllowInstalments(input: FeeStructureRuleInput, requested?: boolean): boolean {
  if (input.chargeSource === "REGISTRATION_FEE") return false;
  if (
    input.priceIsPerPeriod &&
    (input.chargeSource === "GRADE_FEE" ||
      input.chargeSource === "COURSE_FEE" ||
      input.chargeSource === "MODULE_FEE")
  ) {
    return input.billingFrequency !== "YEARLY" && !input.invoiceYearly;
  }
  return Boolean(requested);
}

export function feeBillingDescription(params: {
  name: string;
  amount: number;
  frequency: string;
  priceIsPerPeriod?: boolean;
  invoiceYearly?: boolean;
  yearlyDiscountPercent?: number | null;
  termCount?: number;
}): string {
  if (!params.priceIsPerPeriod) return params.name;
  const periods = periodCountFor(params.frequency, params.termCount);
  const discount = params.yearlyDiscountPercent ?? 0;
  if (params.invoiceYearly || periods <= 1) {
    if (discount > 0 && periods > 1) {
      return `${params.name} (yearly settlement, ${discount}% discount)`;
    }
    return params.name;
  }
  if (discount > 0) {
    const settlement = yearlySettlementAmount(params.amount, periods, discount);
    return `${params.name}. Pay ${formatZAR(settlement)} for the year (${discount}% discount).`;
  }
  return params.name;
}
