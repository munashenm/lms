"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface SubmissionRow {
  id: string;
  content: string | null;
  fileUrl: string | null;
  fileUrls?: unknown;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  status: string;
  late: boolean;
  student: { firstName: string; lastName: string; studentNumber: string };
}

export function HomeworkGradingPanel({
  assignmentId,
  title,
  submissions,
}: {
  assignmentId: string;
  title: string;
  submissions: SubmissionRow[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function grade(submissionId: string, form: FormData) {
    setLoading(submissionId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          grade: form.get("grade") ? Number(form.get("grade")) : undefined,
          feedback: form.get("feedback") || undefined,
          status: form.get("status"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not grade");
      toast.success("Submission updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grade");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {submissions.length === 0 ? (
          <p className="text-sm text-muted">No submissions yet.</p>
        ) : (
          submissions.map((row) => (
            <form
              key={row.id}
              className="rounded-lg border border-border p-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                grade(row.id, new FormData(e.currentTarget));
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {row.student.firstName} {row.student.lastName} ({row.student.studentNumber})
                </p>
                <Badge>{row.late ? "Late" : row.status}</Badge>
              </div>
              <p className="text-xs text-muted">Submitted {formatDate(row.submittedAt)}</p>
              {row.content ? <p className="text-sm whitespace-pre-wrap">{row.content}</p> : null}
              {(Array.isArray(row.fileUrls) ? row.fileUrls : row.fileUrl ? [row.fileUrl] : []).map((url) => (
                <a key={String(url)} href={String(url)} className="text-xs text-primary block" target="_blank" rel="noreferrer">
                  Download submission
                </a>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input name="grade" type="number" min={0} step="0.01" defaultValue={row.grade ?? ""} placeholder="Mark" />
                <select name="status" defaultValue="GRADED" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
                  <option value="GRADED">Graded</option>
                  <option value="RETURNED">Returned</option>
                  <option value="LATE">Late</option>
                </select>
                <Button type="submit" disabled={loading === row.id}>
                  Save
                </Button>
              </div>
              <Input name="feedback" defaultValue={row.feedback ?? ""} placeholder="Feedback" />
            </form>
          ))
        )}
      </CardContent>
    </Card>
  );
}
