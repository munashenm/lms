"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { STUDENT_ABSENCE_TYPE_LABELS } from "@/lib/learner-portal";

export function LearnerLeaveForm({
  guardianRequired,
  endpoint = "/api/me/leave",
  studentId,
}: {
  guardianRequired: boolean;
  endpoint?: string;
  studentId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (guardianRequired) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted">
          This institution requires a parent or guardian to submit leave requests. Please ask your
          parent portal user to apply on your behalf, or contact the school office.
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type: form.get("type"),
          fromDate: form.get("fromDate"),
          toDate: form.get("toDate"),
          reason: form.get("reason"),
          documentUrl: form.get("documentUrl") || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not submit");
      toast.success("Leave request submitted");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request absence</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Absence type</Label>
            <Select name="type" required defaultValue="SICK">
              {Object.entries(STUDENT_ABSENCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input name="fromDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input name="toDate" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <textarea
              name="reason"
              required
              minLength={3}
              rows={3}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>Supporting document URL (optional)</Label>
            <Input name="documentUrl" placeholder="https://..." />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
