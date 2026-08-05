"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate } from "@/lib/utils";
import { STUDENT_LEDGER_TYPE_LABELS } from "@/lib/student-ledger";

type LedgerEntry = {
  id: string;
  type: keyof typeof STUDENT_LEDGER_TYPE_LABELS;
  description: string;
  signedAmount: number;
  reference: string | null;
  entryDate: string;
  academicYear?: { name: string } | null;
};

interface StudentLedgerPanelProps {
  studentId: string;
  balance: number;
  entries: LedgerEntry[];
  canWrite?: boolean;
}

export function StudentLedgerPanel({
  studentId,
  balance,
  entries,
  canWrite = false,
}: StudentLedgerPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function downloadStatement() {
    setActionLoading("download");
    try {
      const res = await fetch(`/api/student-ledger/statement?studentId=${studentId}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fee-statement.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download statement");
    } finally {
      setActionLoading(null);
    }
  }

  async function emailStatement() {
    setActionLoading("email");
    try {
      const res = await fetch("/api/student-ledger/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(data.message || "Statement emailed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to email statement");
    } finally {
      setActionLoading(null);
    }
  }

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/student-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type: form.get("type"),
          description: form.get("description"),
          amount: form.get("amount"),
          reference: form.get("reference") || null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Ledger entry added");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Failed to add ledger entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted">Outstanding balance</p>
            <p className={`text-2xl font-bold ${balance > 0 ? "text-danger" : "text-foreground"}`}>
              {formatZAR(balance)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={balance > 0 ? "danger" : "success"}>
              {balance > 0 ? "Amount owing" : balance < 0 ? "Credit" : "Settled"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadStatement}
              disabled={!!actionLoading}
            >
              {actionLoading === "download" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Download Statement"
              )}
            </Button>
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                onClick={emailStatement}
                disabled={!!actionLoading}
              >
                {actionLoading === "email" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Email Statement"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select name="type" defaultValue="CREDIT" required>
                  {Object.entries(STUDENT_LEDGER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Input name="description" required placeholder="Bursary / discount / adjustment" />
              </div>
              <div className="space-y-1">
                <Label>Amount (R)</Label>
                <Input name="amount" type="number" step="0.01" min="0.01" required />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
              </Button>
              <input type="hidden" name="reference" />
              <input type="hidden" name="notes" />
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {entries.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted text-center">No ledger transactions yet.</p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {STUDENT_LEDGER_TYPE_LABELS[entry.type]} · {formatDate(entry.entryDate)}
                    {entry.reference ? ` · ${entry.reference}` : ""}
                    {entry.academicYear ? ` · ${entry.academicYear.name}` : ""}
                  </p>
                </div>
                <p
                  className={`font-semibold whitespace-nowrap ${
                    entry.signedAmount > 0 ? "text-danger" : "text-green-700"
                  }`}
                >
                  {entry.signedAmount > 0 ? "+" : ""}
                  {formatZAR(entry.signedAmount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
