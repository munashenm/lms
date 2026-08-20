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

interface Option {
  id: string;
  name: string;
  studentNumber?: string;
}

interface BatchResult {
  className: string;
  academicYear: string;
  term: string;
  generated: Array<{ studentId: string; name: string; reportCardId: string }>;
  skipped: Array<{ studentId: string; name: string; reason: string }>;
}

export function ReportCardBatchForm({
  classes,
  academicYears,
  terms,
}: {
  classes: Option[];
  academicYears: Option[];
  terms: Option[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/report-cards/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: form.get("classId"),
          academicYearId: form.get("academicYearId"),
          termId: form.get("termId") || undefined,
          comments: form.get("comments") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not generate class reports");
      const batch = data as BatchResult;
      setResult(batch);
      toast.success(
        `Generated ${batch.generated.length} report${batch.generated.length === 1 ? "" : "s"}${
          batch.skipped.length ? ` · ${batch.skipped.length} skipped` : ""
        }`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate class reports");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate class reports</CardTitle>
        <p className="text-sm text-muted">
          Issue a report card for every learner in the class who has marks. Existing reports for the
          same year and term are skipped. Families are emailed when each report is issued.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select name="classId" required>
              <option value="">Select class...</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Academic Year *</Label>
            <Select name="academicYearId" required>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Select name="termId">
              <option value="">Annual summary</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Principal Comments</Label>
            <Input name="comments" placeholder="Well done. Keep up the good work." />
          </div>
          <Button type="submit" disabled={loading || classes.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate class PDFs"}
          </Button>
        </form>
        {result ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium">
              {result.className} · {result.academicYear}
              {result.term ? ` · ${result.term}` : ""}
            </p>
            <p className="text-muted">
              {result.generated.length} generated
              {result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}
            </p>
            {result.skipped.length > 0 ? (
              <ul className="text-muted space-y-1">
                {result.skipped.map((row) => (
                  <li key={row.studentId}>
                    {row.name}: {row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
