import { describe, expect, it } from "vitest";
import { statementAccountRows } from "@/lib/pdf-fee-statement";

describe("statement of account", () => {
  it("builds debit, credit and running balance from ledger lines", () => {
    const rows = statementAccountRows(
      [
        { date: "1 Jan 2026", description: "Tuition", type: "Charge", amount: 1000 },
        { date: "5 Jan 2026", description: "Payment", type: "Payment", amount: -400 },
        { date: "10 Jan 2026", description: "Bursary", type: "Bursary", amount: -100 },
      ],
      0
    );
    expect(rows).toEqual([
      { date: "1 Jan 2026", description: "Tuition", debit: 1000, credit: 0, balance: 1000 },
      { date: "5 Jan 2026", description: "Payment", debit: 0, credit: 400, balance: 600 },
      { date: "10 Jan 2026", description: "Bursary", debit: 0, credit: 100, balance: 500 },
    ]);
  });
});
