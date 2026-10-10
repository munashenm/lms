"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AttendanceAlertSettings(props: {
  children: Array<{
    id: string;
    name: string;
    notifyAbsent: boolean;
    notifyLate: boolean;
  }>;
}) {
  const [rows, setRows] = useState(props.children);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(studentId: string) {
    const row = rows.find((item) => item.id === studentId);
    if (!row) return;
    setSaving(studentId);
    try {
      const res = await fetch("/api/parent/attendance-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          notifyAbsent: row.notifyAbsent,
          notifyLate: row.notifyLate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Could not save alerts");
      toast.success("Attendance alerts updated");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Could not save alerts");
    } finally {
      setSaving(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Absence and late alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Choose which alerts appear in this portal when the school marks a learner absent or late.
        </p>
        {rows.map((row) => (
          <form
            key={row.id}
            className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            onSubmit={(event) => {
              event.preventDefault();
              void save(row.id);
            }}
          >
            <div>
              <p className="text-sm font-medium">{row.name}</p>
              <label className="mr-4 text-sm">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={row.notifyAbsent}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRows((current) => current.map((item) => item.id === row.id ? { ...item, notifyAbsent: checked } : item));
                  }}
                />
                Absent
              </label>
              <label className="text-sm">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={row.notifyLate}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRows((current) => current.map((item) => item.id === row.id ? { ...item, notifyLate: checked } : item));
                  }}
                />
                Late
              </label>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={saving === row.id}>
              {saving === row.id ? "Saving…" : "Save"}
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
