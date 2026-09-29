export type AgeBucket = "current" | "1_30" | "31_60" | "61_90" | "90_plus";

export const AGE_BUCKET_LABELS: Record<AgeBucket, string> = {
  current: "Current (not yet due)",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_plus": "90+ days",
};

export type AgedInvoice = {
  invoiceId: string;
  studentId: string;
  outstanding: number;
  dueDate: Date | string | null;
};

export type AgedDebtorRow = {
  studentId: string;
  outstanding: number;
  invoiceCount: number;
  oldestDue: Date | null;
  buckets: Record<AgeBucket, number>;
};

function daysOverdue(dueDate: Date | string | null | undefined, asOf: Date): number | null {
  if (!dueDate) return null;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) return null;
  const ms = asOf.getTime() - due.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function bucketForDays(days: number | null): AgeBucket {
  if (days == null || days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function emptyBuckets(): Record<AgeBucket, number> {
  return { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
}

export function buildDebtorsAgeAnalysis(
  invoices: AgedInvoice[],
  asOf: Date = new Date()
): {
  rows: AgedDebtorRow[];
  totals: Record<AgeBucket, number>;
  totalOutstanding: number;
} {
  const map = new Map<string, AgedDebtorRow>();
  const totals = emptyBuckets();

  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    const days = daysOverdue(inv.dueDate, asOf);
    const bucket = bucketForDays(days);
    totals[bucket] += inv.outstanding;

    const existing = map.get(inv.studentId);
    const due = inv.dueDate
      ? typeof inv.dueDate === "string"
        ? new Date(inv.dueDate)
        : inv.dueDate
      : null;

    if (existing) {
      existing.outstanding += inv.outstanding;
      existing.invoiceCount += 1;
      existing.buckets[bucket] += inv.outstanding;
      if (due && (!existing.oldestDue || due < existing.oldestDue)) existing.oldestDue = due;
    } else {
      const buckets = emptyBuckets();
      buckets[bucket] = inv.outstanding;
      map.set(inv.studentId, {
        studentId: inv.studentId,
        outstanding: inv.outstanding,
        invoiceCount: 1,
        oldestDue: due && !Number.isNaN(due.getTime()) ? due : null,
        buckets,
      });
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  return {
    rows,
    totals,
    totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  };
}