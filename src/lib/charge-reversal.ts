import { roundMoney, outstandingOf } from "./money";

export function chargePaidTotal(instalments: Array<{ amountPaid: number | string }>): number {
  return roundMoney(instalments.reduce((sum, row) => sum + Number(row.amountPaid), 0));
}

export function chargeOutstanding(
  amount: number | string,
  instalments: Array<{ amountPaid: number | string }>
): number {
  return outstandingOf(amount, chargePaidTotal(instalments));
}

export function unpaidInstalmentIds(instalments: Array<{ id: string; amountPaid: number | string }>): string[] {
  return instalments.filter((row) => Number(row.amountPaid) <= 0).map((row) => row.id);
}

export function selectedAllocations(
  rows: Array<{ instalmentId: string; amount: number }>,
  paymentAmount: number
): { ok: true; allocations: Array<{ instalmentId: string; amount: number }> } | { ok: false; message: string } {
  const allocations = rows
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({ instalmentId: row.instalmentId, amount: roundMoney(row.amount) }));
  if (!allocations.length) return { ok: true, allocations: [] };
  const sum = roundMoney(allocations.reduce((total, row) => total + row.amount, 0));
  if (sum - roundMoney(paymentAmount) > 0.001) {
    return { ok: false, message: "Allocations exceed the payment amount" };
  }
  return { ok: true, allocations };
}
