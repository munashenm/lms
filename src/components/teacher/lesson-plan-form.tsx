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

export function LessonPlanForm({
  subjects,
  classes,
}: {
  subjects: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/lesson-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: form.get("subjectId"),
          classId: form.get("classId") || null,
          weekNumber: form.get("weekNumber") || null,
          title: form.get("title"),
          topic: form.get("topic"),
          objective: form.get("objective") || null,
          resources: form.get("resources") || null,
          readingMaterial: form.get("readingMaterial") || null,
          lessonDate: form.get("lessonDate"),
          isPublished: form.get("isPublished") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Lesson plan saved");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      toast.error("Could not save lesson plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publish a lesson plan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select name="subjectId" required>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class (optional)</Label>
              <Select name="classId">
                <option value="">All / unspecified</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Lesson date</Label>
              <Input name="lessonDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Week number</Label>
              <Input name="weekNumber" type="number" min={1} max={54} />
            </div>
          </div>
          <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
          <div className="space-y-2"><Label>Topic</Label><Input name="topic" required /></div>
          <div className="space-y-2"><Label>Objective</Label><Input name="objective" /></div>
          <div className="space-y-2"><Label>Resources</Label><Input name="resources" /></div>
          <div className="space-y-2"><Label>Reading material</Label><Input name="readingMaterial" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" className="rounded" defaultChecked />
            Visible to learners
          </label>
          <Button type="submit" disabled={loading || subjects.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save lesson plan
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
