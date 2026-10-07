import { Prisma } from "@prisma/client";

/** Suggested default commercial rate — never applied automatically to existing licences. */
export const DEFAULT_PRICE_PER_LEARNER = new Prisma.Decimal("7.00");
export const DEFAULT_PRICE_CURRENCY = "ZAR";

export function toMoneyDecimal(value: unknown): Prisma.Decimal | null {
  if (value == null || value === "") return null;
  try {
    const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
    if (decimal.isNeg()) return null;
    return decimal;
  } catch {
    return null;
  }
}

/** Estimated monthly subscription: ACTIVE learners × price per learner (null if no rate). */
export function estimatedMonthlySubscription(
  activeLearnerCount: number,
  pricePerLearner: Prisma.Decimal | number | string | null | undefined
): Prisma.Decimal | null {
  const rate = toMoneyDecimal(pricePerLearner);
  if (!rate) return null;
  const learners = Math.max(0, Math.floor(activeLearnerCount));
  return rate.mul(learners);
}

/** Platform MRR: sum of estimated monthly for ACTIVE (paid) licences only. */
export function sumEstimatedMrr(
  rows: Array<{
    effectiveStatus: string;
    activeLearners: number;
    pricePerLearner: Prisma.Decimal | number | string | null | undefined;
  }>
): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const row of rows) {
    if (row.effectiveStatus !== "ACTIVE") continue;
    const estimate = estimatedMonthlySubscription(row.activeLearners, row.pricePerLearner);
    if (estimate) total = total.add(estimate);
  }
  return total;
}

export function formatZar(amount: Prisma.Decimal | null | undefined): string | null {
  if (amount == null) return null;
  return `R${amount.toFixed(2)}`;
}
