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

interface Option { id: string; name: string; code?: string }

interface AssessmentFormProps {
  subjects: Option[];
  terms: Option[];
  apiBase?: string;
}

export function AssessmentForm({ subjects, terms, apiBase = "/api/assessments" }: AssessmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const type = form.get("type") as string;

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          type,
          subjectId: form.get("subjectId") || undefined,
          termId: form.get("termId") || undefined,
          maxMarks: form.get("maxMarks"),
          weight: form.get("weight") || undefined,
          dueDate: form.get("dueDate") || undefined,
          isAssignment: type === "ASSIGNMENT",
          instructions: form.get("instructions") || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Assessment created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create assessment");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New Assessment</Button>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Create Assessment</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required placeholder="Term 2 Programming Test" />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select name="type" defaultValue="TEST">
              <option value="TEST">Test</option>
              <option value="EXAM">Exam</option>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="PROJECT">Project</option>
              <option value="PRACTICAL">Practical</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select name="subjectId">
              <option value="">Select...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Select name="termId">
              <option value="">Select...</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Marks *</Label>
            <Input name="maxMarks" type="number" min="1" defaultValue="100" required />
          </div>
          <div className="space-y-2">
            <Label>Weight %</Label>
            <Input name="weight" type="number" min="1" max="100" placeholder="25" />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input name="dueDate" type="date" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Instructions</Label>
            <textarea
              name="instructions"
              rows={3}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Assignment instructions for students..."
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
