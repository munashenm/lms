"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { assignmentLearnerStatus, canLearnerResubmit, type AssignmentLearnerStatus } from "@/lib/learner-portal";

export interface LearnerAssignmentItem {
  assignmentId: string;
  title: string;
  subject: string;
  teacher?: string | null;
  issuedAt?: Date | string | null;
  dueDate: Date | string | null;
  instructions: string | null;
  maxMarks?: number | null;
  allowLate: boolean;
  submitted: boolean;
  submittedAt?: Date | string | null;
  grade?: number | null;
  feedback?: string | null;
  fileUrl?: string | null;
  content?: string | null;
}

const TABS: Array<{ id: "pending" | "submitted" | "marked" | "overdue" | "all"; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "submitted", label: "Submitted" },
  { id: "marked", label: "Marked" },
  { id: "overdue", label: "Overdue" },
  { id: "all", label: "All" },
];

const STATUS_VARIANT: Record<AssignmentLearnerStatus, "warning" | "success" | "secondary" | "danger"> = {
  NOT_STARTED: "warning",
  IN_PROGRESS: "warning",
  SUBMITTED: "success",
  LATE: "warning",
  OVERDUE: "danger",
  MARKED: "secondary",
  RETURNED: "success",
};

function matchesTab(status: AssignmentLearnerStatus, tab: string) {
  if (tab === "all") return true;
  if (tab === "pending") return status === "NOT_STARTED" || status === "IN_PROGRESS";
  if (tab === "submitted") return status === "SUBMITTED" || status === "LATE";
  if (tab === "marked") return status === "MARKED" || status === "RETURNED";
  if (tab === "overdue") return status === "OVERDUE";
  return true;
}

export function AssignmentBoard({ assignments }: { assignments: LearnerAssignmentItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const [loading, setLoading] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [fileUrl, setFileUrl] = useState<Record<string, string>>({});

  const items = useMemo(
    () =>
      assignments.map((a) => ({
        ...a,
        status: assignmentLearnerStatus({
          submitted: a.submitted,
          submittedAt: a.submittedAt,
          dueDate: a.dueDate,
          grade: a.grade,
          feedback: a.feedback,
        }),
      })),
    [assignments]
  );

  const visible = items.filter((a) => matchesTab(a.status, tab));

  async function handleSubmit(assignment: LearnerAssignmentItem) {
    setLoading(assignment.assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignment.assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content[assignment.assignmentId] || assignment.content || "",
          fileUrl: fileUrl[assignment.assignmentId] || assignment.fileUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Submission failed");
      toast.success("Assignment submitted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted text-sm">
            No assignments in this view.
          </CardContent>
        </Card>
      ) : (
        visible.map((a) => {
          const canEdit = canLearnerResubmit({ dueDate: a.dueDate, allowLate: a.allowLate });
          return (
            <Card key={a.assignmentId} id={a.assignmentId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-sm text-muted">{a.subject}{a.teacher ? ` · ${a.teacher}` : ""}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status]}>{a.status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {a.issuedAt ? `Issued ${formatDate(a.issuedAt)} · ` : ""}
                  {a.dueDate ? `Due ${formatDate(a.dueDate)}` : "No due date"}
                  {a.maxMarks ? ` · ${a.maxMarks} marks` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.instructions ? (
                  <p className="text-sm whitespace-pre-wrap">{a.instructions}</p>
                ) : null}
                {a.submitted ? (
                  <p className="text-sm text-muted">
                    Submitted {a.submittedAt ? formatDate(a.submittedAt) : ""}
                    {a.grade !== null && a.grade !== undefined ? ` · Grade: ${a.grade}` : ""}
                  </p>
                ) : null}
                {a.feedback ? <p className="text-sm rounded-lg bg-background p-3">{a.feedback}</p> : null}
                {canEdit && a.status !== "MARKED" && a.status !== "RETURNED" ? (
                  <>
                    <textarea
                      rows={4}
                      placeholder="Type your submission here..."
                      className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      value={content[a.assignmentId] ?? a.content ?? ""}
                      onChange={(e) =>
                        setContent((prev) => ({ ...prev, [a.assignmentId]: e.target.value }))
                      }
                    />
                    <Input
                      placeholder="Attachment URL (optional)"
                      value={fileUrl[a.assignmentId] ?? a.fileUrl ?? ""}
                      onChange={(e) =>
                        setFileUrl((prev) => ({ ...prev, [a.assignmentId]: e.target.value }))
                      }
                    />
                    <Button
                      onClick={() => handleSubmit(a)}
                      disabled={loading === a.assignmentId}
                    >
                      {loading === a.assignmentId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : a.submitted ? (
                        "Update submission"
                      ) : (
                        "Submit assignment"
                      )}
                    </Button>
                  </>
                ) : !canEdit && !a.submitted ? (
                  <p className="text-sm text-danger">The deadline has passed and late submissions are not allowed.</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
