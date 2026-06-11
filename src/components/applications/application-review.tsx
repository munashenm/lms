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

  async function updateStatus(id: string, status: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const label = APPLICATION_STATUS_LABELS[status] ?? status;
      toast.success(`Application marked as ${label}`);
      router.refresh();
    } catch {
      toast.error("Failed to update application");
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
          <Card key={app.id}>
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
                  <p className="text-xs text-muted mt-1">Submitted {formatDate(app.submittedAt)}</p>
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
                    <Button
                      size="sm"
                      disabled={loading === app.id}
                      onClick={() => updateStatus(app.id, "ACCEPTED")}
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
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
