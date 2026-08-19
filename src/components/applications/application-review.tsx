"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { Copy, ExternalLink } from "lucide-react";

interface Application {
  id: string;
  referenceNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gradeApplied: string | null;
  courseApplied: string | null;
  status: string;
  submittedAt: Date;
  notes: string | null;
  studentId: string | null;
  student?: { id: string; studentNumber: string; userId?: string | null } | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianRelationship?: string | null;
}

const statusVariant: Record<string, "success" | "warning" | "danger" | "secondary" | "default"> = {
  SUBMITTED: "default",
  UNDER_REVIEW: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  WAITLISTED: "secondary",
  WITHDRAWN: "secondary",
};

export function ApplicationReview({ applications }: { applications: Application[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(
    id: string,
    status: string,
    extras?: { hostel?: boolean; transport?: boolean }
  ) {
    setLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update application");
      const label = APPLICATION_STATUS_LABELS[status] ?? status;
      if (data.student?.studentNumber) {
        const invite = data.provision?.invitesSent
          ? " Password setup email sent where an address was provided."
          : "";
        toast.success(`Accepted and enrolled ${data.student.studentNumber}.${invite}`);
      } else if (status === "ACCEPTED" && data.provision) {
        if (data.provision.invitesSent) {
          toast.success(
            `Portal setup complete. ${data.provision.invitesSent} password setup email(s) sent.`
          );
        } else if (data.provision.studentLoginCreated || data.provision.guardianLinked) {
          toast.success("Portal accounts linked. No new invites were sent.");
        } else {
          toast.success(
            "No new portal accounts created. Add an email on the application, or that address may already belong to another role or school."
          );
        }
      } else {
        toast.success(`Application marked as ${label}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update application");
    } finally {
      setLoading(null);
    }
  }

  function copyReference(ref: string) {
    navigator.clipboard.writeText(ref);
    toast.success("Reference copied");
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">
          No applications yet. Share the{" "}
          <Link href="/apply" className="text-primary hover:underline" target="_blank">
            public application form
          </Link>{" "}
          with prospective students.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => {
        const pending = app.status === "SUBMITTED" || app.status === "UNDER_REVIEW";
        return (
          <Card key={app.id} data-application-card>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{app.firstName} {app.lastName}</p>
                    <Badge variant={statusVariant[app.status] ?? "secondary"}>
                      {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted font-mono">{app.referenceNo}</p>
                    <button
                      type="button"
                      onClick={() => copyReference(app.referenceNo)}
                      className="text-muted hover:text-primary"
                      aria-label="Copy reference"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <Link
                      href={`/apply/status?ref=${encodeURIComponent(app.referenceNo)}`}
                      target="_blank"
                      className="text-muted hover:text-primary"
                      aria-label="View public status"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-sm text-muted mt-2">
                    {app.gradeApplied && `Grade: ${app.gradeApplied}`}
                    {app.courseApplied && ` · Course: ${app.courseApplied}`}
                  </p>
                  <p className="text-sm text-muted">
                    {app.email} {app.phone && `· ${app.phone}`}
                  </p>
                  {app.guardianFirstName || app.guardianLastName || app.guardianEmail ? (
                    <p className="text-sm text-muted mt-1">
                      Guardian: {[app.guardianFirstName, app.guardianLastName].filter(Boolean).join(" ") || "—"}
                      {app.guardianRelationship ? ` (${app.guardianRelationship})` : ""}
                      {app.guardianEmail ? ` · ${app.guardianEmail}` : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted mt-1">Submitted {formatDate(app.submittedAt)}</p>
                  {app.student?.studentNumber ? (
                    <p className="text-sm mt-2">
                      Enrolled{" "}
                      <Link href={`/admin/students/${app.student.id}`} className="text-primary hover:underline font-mono">
                        {app.student.studentNumber}
                      </Link>
                      {app.student.userId ? " · learner portal linked" : ""}
                    </p>
                  ) : null}
                </div>
                {pending ? (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {app.status === "SUBMITTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === app.id}
                        onClick={() => updateStatus(app.id, "UNDER_REVIEW")}
                      >
                        Start Review
                      </Button>
                    )}
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="hostel" className="rounded border-border" />
                      Hostel
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="transport" className="rounded border-border" />
                      Transport
                    </label>
                    <Button
                      size="sm"
                      disabled={loading === app.id}
                      onClick={(e) => {
                        const card = (e.currentTarget as HTMLElement).closest("[data-application-card]");
                        const hostel = card?.querySelector<HTMLInputElement>('input[name="hostel"]')?.checked;
                        const transport = card?.querySelector<HTMLInputElement>('input[name="transport"]')?.checked;
                        updateStatus(app.id, "ACCEPTED", { hostel: Boolean(hostel), transport: Boolean(transport) });
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === app.id}
                      onClick={() => updateStatus(app.id, "WAITLISTED")}
                    >
                      Waitlist
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={loading === app.id}
                      onClick={() => updateStatus(app.id, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : app.status === "ACCEPTED" && app.studentId ? (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === app.id}
                      onClick={() => updateStatus(app.id, "ACCEPTED")}
                    >
                      Set up portal
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
