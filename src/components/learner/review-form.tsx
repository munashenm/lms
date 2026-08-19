"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const QUESTIONS = [
  ["teachingQuality", "Teaching quality"],
  ["communication", "Communication"],
  ["preparedness", "Preparedness"],
  ["subjectKnowledge", "Subject knowledge"],
  ["availability", "Availability / support"],
  ["overall", "Overall experience"],
] as const;

export function TeacherReviewForm({
  teachers,
  anonymous,
  teacherLabel = "Educator",
}: {
  teachers: Array<{ id: string; firstName: string; lastName: string }>;
  anonymous: boolean;
  teacherLabel?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (teachers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted">
          No {teacherLabel.toLowerCase()}s are currently assigned to your class.
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/me/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: form.get("teacherId"),
          teachingQuality: Number(form.get("teachingQuality")),
          communication: Number(form.get("communication")),
          preparedness: Number(form.get("preparedness")),
          subjectKnowledge: Number(form.get("subjectKnowledge")),
          availability: Number(form.get("availability")),
          overall: Number(form.get("overall")),
          comment: form.get("comment") || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not submit review");
      toast.success("Review submitted");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submit feedback</CardTitle>
        <p className="text-xs text-muted">
          {anonymous
            ? `Reviews are anonymous. Your name is not shown to the ${teacherLabel.toLowerCase()}.`
            : "Your name will be visible to authorised staff with this review."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{teacherLabel}</Label>
            <Select name="teacherId" required>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUESTIONS.map(([name, label]) => (
              <div key={name} className="space-y-2">
                <Label>{label}</Label>
                <Select name={name} defaultValue="4" required>
                  <option value="5">5 — Excellent</option>
                  <option value="4">4 — Good</option>
                  <option value="3">3 — Satisfactory</option>
                  <option value="2">2 — Needs improvement</option>
                  <option value="1">1 — Poor</option>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Comments (optional)</Label>
            <textarea
              name="comment"
              rows={3}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
