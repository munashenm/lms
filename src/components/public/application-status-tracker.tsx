"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Clock } from "lucide-react";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_DESCRIPTIONS,
} from "@/lib/application-status";

interface ApplicationStatus {
  referenceNo: string;
  firstName: string;
  lastName: string;
  status: string;
  gradeApplied: string | null;
  courseApplied: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  schoolName: string;
}

export function ApplicationStatusTracker() {
  const searchParams = useSearchParams();
  const [ref, setRef] = useState(searchParams.get("ref") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApplicationStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const initialRef = searchParams.get("ref");
    if (initialRef) {
      lookup(initialRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(reference?: string) {
    const query = (reference ?? ref).trim();
    if (!query) {
      toast.error("Enter your reference number");
      return;
    }
    setLoading(true);
    setNotFound(false);
    setResult(null);

    try {
      const res = await fetch(`/api/applications/status?ref=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setResult(data.application);
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Track your application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Enter the reference number you received when you submitted your application
            (e.g. APP-2026-0001).
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="ref">Reference number</Label>
              <Input
                id="ref"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                placeholder="APP-2026-0001"
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => lookup()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {notFound && (
        <Card>
          <CardContent className="py-8 text-center text-muted">
            No application found with that reference number. Please check and try again.
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Reference</p>
                <p className="font-mono text-lg font-bold">{result.referenceNo}</p>
              </div>
              <Badge
                variant={
                  result.status === "ACCEPTED"
                    ? "success"
                    : result.status === "REJECTED"
                      ? "danger"
                      : "secondary"
                }
                className="text-sm"
              >
                {APPLICATION_STATUS_LABELS[result.status] ?? result.status}
              </Badge>
            </div>

            <p className="text-sm text-muted">
              {APPLICATION_STATUS_DESCRIPTIONS[result.status] ?? "Status updated."}
            </p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Applicant</dt>
                <dd className="font-medium">{result.firstName} {result.lastName}</dd>
              </div>
              <div>
                <dt className="text-muted">Institution</dt>
                <dd className="font-medium">{result.schoolName}</dd>
              </div>
              {result.gradeApplied && (
                <div>
                  <dt className="text-muted">Grade</dt>
                  <dd>{result.gradeApplied}</dd>
                </div>
              )}
              {result.courseApplied && (
                <div>
                  <dt className="text-muted">Programme</dt>
                  <dd>{result.courseApplied}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Submitted
                </dt>
                <dd>{new Date(result.submittedAt).toLocaleDateString("en-ZA")}</dd>
              </div>
              {result.reviewedAt && (
                <div>
                  <dt className="text-muted">Last updated</dt>
                  <dd>{new Date(result.reviewedAt).toLocaleDateString("en-ZA")}</dd>
                </div>
              )}
            </dl>

            {result.status === "ACCEPTED" && (
              <p className="text-sm bg-success/10 text-success rounded-lg p-3">
                Please check your email/SMS for enrolment instructions. Contact admissions if you
                have not heard from us within 5 working days.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted">
        Haven&apos;t applied yet?{" "}
        <Link href="/apply" className="text-primary font-medium hover:underline">
          Start your application
        </Link>
      </p>
    </div>
  );
}
