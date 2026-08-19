/** Fixed-precision money helpers. Never use binary floating-point for balances. */

export function toCents(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function roundMoney(amount: number | string): number {
  return fromCents(toCents(amount));
}

/** Split a total into N instalments, distributing leftover cents to the first rows. */
export function splitInstalmentAmounts(total: number, parts: number): number[] {
  const count = Math.max(1, Math.floor(parts));
  const cents = toCents(total);
  if (count === 1) return [fromCents(cents)];
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => fromCents(base + (i < remainder ? 1 : 0)));
}

export function addMoney(...amounts: Array<number | string>): number {
  return fromCents(amounts.reduce<number>((sum, a) => sum + toCents(a), 0));
}

export function outstandingOf(amount: number | string, amountPaid: number | string): number {
  return Math.max(0, roundMoney(Number(amount) - Number(amountPaid)));
}
