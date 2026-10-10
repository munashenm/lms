import type { InvoiceStatus } from "@prisma/client";
import { getOutstandingBalance } from "./finance";
import { roundMoney } from "./money";

export interface InvoiceSummaryRow {
  status: InvoiceStatus;
  total: number | string | { toString(): string };
  amountPaid: number | string | { toString(): string };
  dueDate?: Date | string | null;
}

/** Open-invoice figures shared by the admin and finance dashboards. */
export function summarizeInvoices(rows: InvoiceSummaryRow[]) {
  let outstanding = 0;
  let overdueCount = 0;
  for (const row of rows) {
    if (row.status === "CANCELLED" || row.status === "DRAFT") continue;
    const total = Number(row.total);
    const paid = Number(row.amountPaid);
    const balance = getOutstandingBalance(total, paid);
    outstanding += balance;
    const due = row.dueDate ? new Date(row.dueDate) : null;
    if (balance > 0 && due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
      overdueCount += 1;
    }
  }
  return { outstanding: roundMoney(outstanding), overdueCount };
}
