"use client";

import { useMemo, useState } from "react";
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

type StudentRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string | null;
  className: string | null;
  outstanding: number;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

type BatchRow = {
  id: string;
  category: string;
  channel: string;
  status: string;
  totalCount: number;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};

interface BulkRemindersManagerProps {
  schoolId: string;
  students: StudentRow[];
  totalOutstanding: number;
  grades: { id: string; name: string }[];
  batches: BatchRow[];
  initialGradeId?: string;
  initialMinBalance?: number;
}

export function BulkRemindersManager({
  schoolId,
  students,
  totalOutstanding,
  grades,
  batches: initialBatches,
  initialGradeId = "",
  initialMinBalance = 0.01,
}: BulkRemindersManagerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    students.forEach((s) => {
      init[s.studentId] = true;
    });
    return init;
  });
  const [action, setAction] = useState<"FEE_REMINDER" | "FEE_STATEMENT">("FEE_REMINDER");
  const [channel, setChannel] = useState<"EMAIL" | "SMS" | "BOTH">("EMAIL");
  const [loading, setLoading] = useState<string | null>(null);
  const [batches, setBatches] = useState(initialBatches);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );
  const selectedTotal = students
    .filter((s) => selected[s.studentId])
    .reduce((sum, s) => sum + s.outstanding, 0);

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {};
    students.forEach((s) => {
      next[s.studentId] = value;
    });
    setSelected(next);
  }

  async function queueBatch() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }
    setLoading("queue");
    try {
      const res = await fetch("/api/finance/bulk-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          action,
          channel,
          gradeId: initialGradeId || null,
          minBalance: initialMinBalance,
          studentIds: selectedIds,
          processImmediately: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(
        `Queued ${data.batch.totalCount} messages` +
          (data.processResult
            ? ` · processed ${data.processResult.processed} (${data.processResult.remaining} remaining)`
            : "")
      );
      setBatches((prev) => [data.batch, ...prev]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue failed");
    } finally {
      setLoading(null);
    }
  }

  async function processBatch(id: string, retry = false) {
    setLoading(id);
    try {
      const res = await fetch(`/api/finance/bulk-reminders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: retry ? "retry_failed" : "process",
          limit: 15,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(
        retry
          ? "Failed messages re-queued and processing"
          : `Processed ${data.processResult.processed} · ${data.processResult.remaining} remaining`
      );
      setBatches((prev) => prev.map((b) => (b.id === id ? data.batch : b)));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Process failed");
    } finally {
      setLoading(null);
    }
  }

  const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "secondary"> = {
    PENDING: "default",
    PROCESSING: "warning",
    COMPLETED: "success",
    CANCELLED: "secondary",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter outstanding accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>Grade</Label>
              <Select name="gradeId" defaultValue={initialGradeId}>
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Min balance (R)</Label>
              <Input
                name="minBalance"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initialMinBalance}
              />
            </div>
            <Button type="submit" variant="outline">
              Apply filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">
              {students.length} students · {formatZAR(totalOutstanding)} outstanding
            </CardTitle>
            <p className="text-sm text-muted mt-1">
              Selected: {selectedIds.length} · {formatZAR(selectedTotal)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>
              Select all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Action</Label>
              <Select
                value={action}
                onChange={(e) => setAction(e.target.value as typeof action)}
              >
                <option value="FEE_REMINDER">Fee reminder</option>
                <option value="FEE_STATEMENT">Email statements</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Email + SMS</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={queueBatch}
                disabled={!!loading || selectedIds.length === 0}
              >
                {loading === "queue" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Queue & send batch"
                )}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Class</th>
                  <th className="px-3 py-2">Outstanding</th>
                  <th className="px-3 py-2 hidden md:table-cell">Contact</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted">
                      No students match this outstanding filter.
                    </td>
                  </tr>
                )}
                {students.map((s) => (
                  <tr key={s.studentId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[s.studentId]}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [s.studentId]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {s.lastName}, {s.firstName}
                      </p>
                      <p className="text-xs text-muted">{s.studentNumber}</p>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted">
                      {s.gradeName ?? "—"}
                      {s.className ? ` / ${s.className}` : ""}
                    </td>
                    <td className="px-3 py-2 font-semibold text-danger">
                      {formatZAR(s.outstanding)}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted">
                      {s.guardianEmail ?? "—"}
                      <br />
                      {s.guardianPhone ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent batches</CardTitle>
          <p className="text-sm text-muted">
            Messages are queued and processed in small batches to avoid flooding the provider.
          </p>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {batches.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No batches yet.</p>
          )}
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant[batch.status] ?? "secondary"}>
                    {batch.status}
                  </Badge>
                  <span className="font-medium">
                    {batch.category.replaceAll("_", " ")}
                  </span>
                  <span className="text-muted">· {batch.channel}</span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {formatDate(batch.createdAt)} · total {batch.totalCount} · queued{" "}
                  {batch.queuedCount} · sent {batch.sentCount} · failed {batch.failedCount}
                </p>
              </div>
              <div className="flex gap-2">
                {batch.queuedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loading}
                    onClick={() => processBatch(batch.id)}
                  >
                    {loading === batch.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Process next"
                    )}
                  </Button>
                )}
                {batch.failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!loading}
                    onClick={() => processBatch(batch.id, true)}
                  >
                    Retry failed
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
