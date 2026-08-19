import { AccrualMethod, LeaveType } from "@prisma/client";
import { roundMoney } from "./money";

export interface LeaveBalanceParts {
  openingBalance: number;
  accrued: number;
  taken: number;
}

export function remainingLeaveDays(parts: LeaveBalanceParts): number {
  return roundMoney(parts.openingBalance + parts.accrued - parts.taken);
}

/** Accrual uses the policy's configured daysPerYear. No BCEA/SARS tables are hard-coded. */
export function accruedDaysFor(params: {
  daysPerYear: number;
  method: AccrualMethod;
  cycleYear: number;
  asOf: Date;
}): number {
  const grant = roundMoney(params.daysPerYear);
  if (grant <= 0) return 0;
  if (params.method === AccrualMethod.NONE || params.method === AccrualMethod.YEARLY) {
    return grant;
  }
  const yearStart = Date.UTC(params.cycleYear, 0, 1);
  if (params.asOf.getTime() < yearStart) return 0;
  const months =
    (params.asOf.getUTCFullYear() - params.cycleYear) * 12 + params.asOf.getUTCMonth() + 1;
  const capped = Math.min(12, Math.max(0, months));
  return roundMoney(Math.min(grant, (grant * capped) / 12));
}

export function unpaidLeaveDoesNotConsume(type: LeaveType): boolean {
  return type === LeaveType.UNPAID;
}
