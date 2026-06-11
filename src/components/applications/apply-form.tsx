"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";

interface School {
  slug: string;
  name: string;
  institutionType: string;
  city: string | null;
}

export function ApplyForm({ schools }: { schools: School[] }) {
  const [loading, setLoading] = useState(false);
  const [referenceNo, setReferenceNo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else toast.error(data.message || "Submission failed");
        return;
      }
      setReferenceNo(data.referenceNo);
      toast.success("Application submitted!");
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (referenceNo) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-success mx-auto" />
          <div>
            <p className="font-semibold text-lg">Application Submitted</p>
            <p className="text-muted text-sm mt-2">Your reference number is:</p>
            <p className="font-mono text-xl font-bold text-primary mt-2">{referenceNo}</p>
            <p className="text-xs text-muted mt-4">
              Keep this reference number to track your application status.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Form</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Institution *</Label>
            <Select name="schoolSlug" required>
              <option value="">Select school/college...</option>
              {schools.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} {s.city && `(${s.city})`}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input name="firstName" required error={errors.firstName} />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input name="lastName" required error={errors.lastName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SA ID Number</Label>
            <Input name="saIdNumber" maxLength={13} placeholder="13-digit ID" error={errors.saIdNumber} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" error={errors.email} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" placeholder="082 123 4567" error={errors.phone} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grade Applying For</Label>
              <Input name="gradeApplied" placeholder="e.g. Grade 10, NQF Level 4" />
            </div>
            <div className="space-y-2">
              <Label>Course Applying For</Label>
              <Input name="courseApplied" placeholder="e.g. Information Technology" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <textarea
              name="notes"
              rows={3}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Any additional information..."
            />
          </div>
          <p className="text-xs text-muted">
            By submitting, you consent to the processing of your personal information in
            accordance with POPIA.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
