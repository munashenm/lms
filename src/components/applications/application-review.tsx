"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

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
      toast.success(`Application ${status.toLowerCase().replace("_", " ")}`);
      router.refresh();
    } catch {
      toast.error("Failed to update application");
    } finally {
      setLoading(null);
    }
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">No applications yet.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <Card key={app.id}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{app.firstName} {app.lastName}</p>
                  <Badge variant={statusVariant[app.status] ?? "secondary"}>{app.status}</Badge>
                </div>
                <p className="text-xs text-muted font-mono mt-1">{app.referenceNo}</p>
                <p className="text-sm text-muted mt-2">
                  {app.gradeApplied && `Grade: ${app.gradeApplied}`}
                  {app.courseApplied && ` · Course: ${app.courseApplied}`}
                </p>
                <p className="text-sm text-muted">{app.email} {app.phone && `· ${app.phone}`}</p>
                <p className="text-xs text-muted mt-1">Submitted {formatDate(app.submittedAt)}</p>
              </div>
              {app.status === "SUBMITTED" || app.status === "UNDER_REVIEW" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading === app.id}
                    onClick={() => updateStatus(app.id, "UNDER_REVIEW")}
                  >
                    Review
                  </Button>
                  <Button
                    size="sm"
                    disabled={loading === app.id}
                    onClick={() => updateStatus(app.id, "ACCEPTED")}
                  >
                    Accept
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
      ))}
    </div>
  );
}
