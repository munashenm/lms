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

type Question = {
  id: string;
  prompt: string;
  type: string;
  options: unknown;
  points: number;
  correctAnswer?: string | null;
};

export function ExamQuestionForm({
  assessmentId,
  questions,
}: {
  assessmentId: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("MULTIPLE_CHOICE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const options = [form.get("optionA"), form.get("optionB"), form.get("optionC"), form.get("optionD")]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: form.get("prompt"),
          type,
          options: type === "MULTIPLE_CHOICE" ? options : type === "TRUE_FALSE" ? ["True", "False"] : [],
          correctAnswer: form.get("correctAnswer") || "",
          points: form.get("points") || 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      toast.success("Question added");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add question");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Online exam questions</CardTitle>
        <p className="text-sm text-muted">
          Learners can sit this paper in the portal once it is published and at least one question exists.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.length > 0 ? (
          <ol className="space-y-2 text-sm list-decimal pl-5">
            {questions.map((q) => (
              <li key={q.id}>
                <span className="font-medium">{q.prompt}</span>
                <span className="text-muted"> · {q.type} · {q.points} marks</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No questions yet.</p>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Question</Label>
            <textarea name="prompt" required rows={2} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short answer</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Marks</Label>
            <Input name="points" type="number" min="1" defaultValue="1" />
          </div>
          {type === "MULTIPLE_CHOICE" ? (
            <>
              <Input name="optionA" placeholder="Option A" />
              <Input name="optionB" placeholder="Option B" />
              <Input name="optionC" placeholder="Option C" />
              <Input name="optionD" placeholder="Option D" />
            </>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label>Correct answer</Label>
            <Input
              name="correctAnswer"
              placeholder={type === "TRUE_FALSE" ? "True or False" : "Exact match for auto-marking"}
            />
          </div>
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add question"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
