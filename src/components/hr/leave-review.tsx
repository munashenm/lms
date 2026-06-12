"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { FileText, Download } from "lucide-react";

interface LeaveApplicant {
  firstName: string;
  lastName: string;
  role: UserRole;
  email?: string;
}

interface LeaveTeacher {
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  department?: string | null;
}

interface LeaveRequest {
  id: string;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  days: Decimal | number | string;
  reason: string;
  notes: string | null;
  sickNoteUrl: string | null;
  sickNoteFilename: string | null;
  applicant: LeaveApplicant;
  teacher: LeaveTeacher | null;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "secondary" | "default"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "secondary",
};

const TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
  FAMILY: "Family",
  UNPAID: "Unpaid",
  OTHER: "Other",
};

function applicantName(req: LeaveRequest) {
  if (req.teacher) return `${req.teacher.firstName} ${req.teacher.lastName}`;
  return `${req.applicant.firstName} ${req.applicant.lastName}`;
}

export function LeaveReview({ leaveRequests, admin = false }: { leaveRequests: LeaveRequest[]; admin?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Leave ${status.toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Failed to update leave request");
    } finally {
      setLoading(null);
    }
  }

  if (leaveRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted text-sm">
          {admin ? "No leave requests." : "You have no leave requests yet."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {leaveRequests.map((req) => (
        <Card key={req.id}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {admin && <p className="font-semibold">{applicantName(req)}</p>}
                  <Badge variant={STATUS_VARIANT[req.status] ?? "secondary"}>{req.status}</Badge>
                  <Badge variant="secondary">{TYPE_LABELS[req.type] ?? req.type}</Badge>
                  {admin && (
                    <Badge variant="secondary">{ROLE_LABELS[req.applicant.role]}</Badge>
                  )}
                </div>
                {admin && req.teacher?.employeeNumber && (
                  <p className="text-xs text-muted font-mono mt-1">{req.teacher.employeeNumber}</p>
                )}
                <p className="text-sm text-muted mt-2">
                  {formatDate(req.startDate)} – {formatDate(req.endDate)} · {Number(req.days)} day(s)
                </p>
                <p className="text-sm mt-1">{req.reason}</p>
                {req.sickNoteUrl && (
                  <a
                    href={req.sickNoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                  >
                    <FileText className="h-4 w-4" />
                    {req.sickNoteFilename ?? "Sick note"}
                    <Download className="h-3 w-3" />
                  </a>
                )}
              </div>
              {admin && req.status === "PENDING" && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" disabled={loading === req.id} onClick={() => updateStatus(req.id, "APPROVED")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" disabled={loading === req.id} onClick={() => updateStatus(req.id, "REJECTED")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
