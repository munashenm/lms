"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { APPLICATION_DOCUMENT_OPTIONS } from "@/lib/admissions";
import { johannesburgDatetimeLocalValue } from "@/lib/utils";

export function WebsiteAdmissionsForm({
  schoolId,
  applicationsOpen,
  applicationsOpenFrom,
  applicationsOpenUntil,
  admissionYearId,
  applicationInstructions,
  requiredApplicationDocuments,
  years,
  grades,
  courses,
  gradeLabel,
  programmeLabel,
}: {
  schoolId?: string;
  applicationsOpen: boolean;
  applicationsOpenFrom: Date | string | null;
  applicationsOpenUntil: Date | string | null;
  admissionYearId: string | null;
  applicationInstructions: string | null;
  requiredApplicationDocuments: string[];
  years: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string; openForApplications: boolean }>;
  courses: Array<{ id: string; name: string; openForApplications: boolean }>;
  gradeLabel: string;
  programmeLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const selectedDocs = new Set(
    requiredApplicationDocuments.length ? requiredApplicationDocuments : ["ID_DOCUMENT", "BIRTH_CERTIFICATE", "LATEST_REPORT", "PROOF_OF_RESIDENCE"]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const gradeIds = form.getAll("gradeIds").map(String);
    const courseIds = form.getAll("courseIds").map(String);
    const docs = form.getAll("requiredApplicationDocuments").map(String);
    try {
      const res = await fetch("/api/website/admissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(schoolId ? { schoolId } : {}),
          applicationsOpen: form.get("applicationsOpen") === "on",
          applicationsOpenFrom: form.get("applicationsOpenFrom") || null,
          applicationsOpenUntil: form.get("applicationsOpenUntil") || null,
          admissionYearId: form.get("admissionYearId") || null,
          applicationInstructions: form.get("applicationInstructions"),
          requiredApplicationDocuments: docs,
          gradeIds,
          courseIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save admissions");
      }
      toast.success("Admissions settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save admissions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application window</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="applicationsOpen" defaultChecked={applicationsOpen} className="h-4 w-4" />
            Applications are open
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Opening date</Label>
              <Input
                type="datetime-local"
                name="applicationsOpenFrom"
                defaultValue={applicationsOpenFrom ? johannesburgDatetimeLocalValue(applicationsOpenFrom) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Closing date</Label>
              <Input
                type="datetime-local"
                name="applicationsOpenUntil"
                defaultValue={applicationsOpenUntil ? johannesburgDatetimeLocalValue(applicationsOpenUntil) : ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Admission session / intake</Label>
            <Select name="admissionYearId" defaultValue={admissionYearId ?? ""}>
              <option value="">Use current calendar year</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Application instructions</Label>
            <textarea
              name="applicationInstructions"
              rows={5}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              defaultValue={applicationInstructions ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available {gradeLabel.toLowerCase()}s / {programmeLabel.toLowerCase()}s</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">{gradeLabel}s open for applications</p>
            <div className="space-y-2">
              {grades.map((grade) => (
                <label key={grade.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="gradeIds" value={grade.id} defaultChecked={grade.openForApplications} />
                  {grade.name}
                </label>
              ))}
              {!grades.length ? <p className="text-sm text-muted">No grades captured yet.</p> : null}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">{programmeLabel}s open for applications</p>
            <div className="space-y-2">
              {courses.map((course) => (
                <label key={course.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="courseIds" value={course.id} defaultChecked={course.openForApplications} />
                  {course.name}
                </label>
              ))}
              {!courses.length ? <p className="text-sm text-muted">No programmes captured yet.</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required documents</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {APPLICATION_DOCUMENT_OPTIONS.map((doc) => (
            <label key={doc.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiredApplicationDocuments" value={doc.value} defaultChecked={selectedDocs.has(doc.value)} />
              {doc.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save admissions"}
      </Button>
    </form>
  );
}
