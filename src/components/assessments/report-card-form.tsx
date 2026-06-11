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

interface Option { id: string; name: string; studentNumber?: string }

interface ReportCardFormProps {
  students: Option[];
  academicYears: Option[];
  terms: Option[];
}

export function ReportCardForm({ students, academicYears, terms }: ReportCardFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/report-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Report card generated");
      router.refresh();
    } catch {
      toast.error("Failed to generate report card");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Generate Report Card</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Student *</Label>
            <Select name="studentId" required>
              <option value="">Select student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.studentNumber && `(${s.studentNumber})`}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Academic Year *</Label>
            <Select name="academicYearId" required>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Select name="termId">
              <option value="">Annual summary</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Principal Comments</Label>
            <Input name="comments" placeholder="Well done. Keep up the good work." />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate PDF"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
