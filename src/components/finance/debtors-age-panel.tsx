"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatZAR } from "@/lib/utils";
import { AGE_BUCKET_LABELS, type AgeBucket } from "@/lib/finance/debtors-age";

type Row = {
  studentId: string;
  outstanding: number;
  invoiceCount: number;
  oldestDue: string | null;
  buckets: Record<AgeBucket, number>;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    grade?: { name: string } | null;
    class?: { name: string } | null;
  } | null;
};

const BUCKETS: AgeBucket[] = ["current", "1_30", "31_60", "61_90", "90_plus"];

export function DebtorsAgePanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Record<AgeBucket, number> | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/finance/debtors-age");
        const data = await res.json();
        if (res.ok) {
          setRows(data.rows ?? []);
          setTotals(data.totals ?? null);
          setTotalOutstanding(data.totalOutstanding ?? 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading age analysis…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BUCKETS.map((bucket) => (
          <Card key={bucket}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted uppercase tracking-wide">{AGE_BUCKET_LABELS[bucket]}</p>
              <p className="text-lg font-semibold mt-1">{formatZAR(totals?.[bucket] ?? 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted">
        Total outstanding: <span className="font-semibold text-foreground">{formatZAR(totalOutstanding)}</span>
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aged debtors</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                {BUCKETS.map((b) => (
                  <th key={b} className="text-right px-3 py-3 font-medium text-muted hidden md:table-cell">
                    {AGE_BUCKET_LABELS[b].split(" ")[0]}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-muted">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">Oldest due</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No outstanding debtors.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.studentId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {row.student ? (
                        <>
                          <Link
                            href={`/admin/finance/invoices?studentId=${row.student.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.student.firstName} {row.student.lastName}
                          </Link>
                          <p className="text-xs text-muted">{row.student.studentNumber}</p>
                        </>
                      ) : (
                        row.studentId
                      )}
                    </td>
                    {BUCKETS.map((b) => (
                      <td key={b} className="px-3 py-3 text-right hidden md:table-cell text-muted">
                        {row.buckets[b] ? formatZAR(row.buckets[b]) : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold text-danger">
                      {formatZAR(row.outstanding)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted">
                      {row.oldestDue ? formatDate(row.oldestDue) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}