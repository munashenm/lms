"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { STUDENT_ABSENCE_TYPE_LABELS } from "@/lib/learner-portal";

export function LearnerLeaveReviewList({
  requests,
}: {
  requests: Array<{
    id: string;
    type: string;
    fromDate: Date | string;
    toDate: Date | string;
    reason: string;
    status: string;
    student: { firstName: string; lastName: string; studentNumber: string };
  }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function review(id: string, action: "approve" | "reject") {
    setLoading(`${action}-${id}`);
    try {
      const res = await fetch(`/api/student-absence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      router.refresh();
    } catch {
      toast.error("Could not update request");
    } finally {
      setLoading(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No learner leave requests.</p>;
  }

  const variant: Record<string, "warning" | "success" | "danger" | "secondary"> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CANCELLED: "secondary",
  };

  return (
    <div className="divide-y divide-border">
      {requests.map((row) => (
        <div key={row.id} className="px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-sm">
                {row.student.firstName} {row.student.lastName} ({row.student.studentNumber})
              </p>
              <p className="text-xs text-muted">
                {STUDENT_ABSENCE_TYPE_LABELS[row.type as keyof typeof STUDENT_ABSENCE_TYPE_LABELS] ?? row.type}
                {" · "}
                {formatDate(row.fromDate)} – {formatDate(row.toDate)}
              </p>
            </div>
            <Badge variant={variant[row.status] ?? "secondary"}>{row.status}</Badge>
          </div>
          <p className="text-sm">{row.reason}</p>
          {row.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={loading === `approve-${row.id}`} onClick={() => review(row.id, "approve")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" disabled={loading === `reject-${row.id}`} onClick={() => review(row.id, "reject")}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
