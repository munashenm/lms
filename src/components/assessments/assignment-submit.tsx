"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AssignmentItem {
  assignmentId: string;
  title: string;
  subject: string;
  dueDate: Date | null;
  instructions: string | null;
  submitted: boolean;
  submittedAt?: Date;
  grade?: number | null;
}

export function AssignmentSubmit({ assignments }: { assignments: AssignmentItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});

  async function handleSubmit(assignmentId: string) {
    setLoading(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content[assignmentId] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      toast.success("Assignment submitted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setLoading(null);
    }
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">No assignments available.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((a) => (
        <Card key={a.assignmentId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{a.title}</CardTitle>
              {a.submitted ? (
                <Badge variant="success">Submitted</Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
            </div>
            <p className="text-sm text-muted">{a.subject}</p>
            {a.dueDate && (
              <p className="text-xs text-muted">Due {formatDate(a.dueDate)}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {a.instructions && (
              <p className="text-sm whitespace-pre-wrap">{a.instructions}</p>
            )}
            {a.submitted ? (
              <p className="text-sm text-muted">
                Submitted {a.submittedAt && formatDate(a.submittedAt)}
                {a.grade !== null && a.grade !== undefined && ` · Grade: ${a.grade}`}
              </p>
            ) : (
              <>
                <textarea
                  rows={4}
                  placeholder="Type your submission here..."
                  className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={content[a.assignmentId] ?? ""}
                  onChange={(e) =>
                    setContent((prev) => ({ ...prev, [a.assignmentId]: e.target.value }))
                  }
                />
                <Button
                  onClick={() => handleSubmit(a.assignmentId)}
                  disabled={loading === a.assignmentId || !content[a.assignmentId]}
                >
                  {loading === a.assignmentId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit Assignment"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
