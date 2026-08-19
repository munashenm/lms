import { roundMoney } from "./money";

/** Reversing GL rows keep type EXPENSE and negate the amount so reports net correctly. */
export function reversingLedgerAmount(amount: number | string): number {
  return -roundMoney(Math.abs(Number(amount)));
}
