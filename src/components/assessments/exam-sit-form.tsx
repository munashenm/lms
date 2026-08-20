"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Question = {
  id: string;
  prompt: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  options: unknown;
  points: number;
};

function asOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function ExamSitForm({
  assessmentId,
  title,
  durationMinutes,
  questions,
  startedAt,
}: {
  assessmentId: string;
  title: string;
  durationMinutes?: number | null;
  questions: Question[];
  startedAt: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const submittingRef = useRef(false);
  const submitRef = useRef<(auto?: boolean) => void>(() => undefined);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    durationMinutes ? durationMinutes * 60 : null
  );

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: value };
      answersRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    if (!durationMinutes) return;
    const ends = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    const tick = (intervalId: number) => {
      const seconds = Math.max(0, Math.floor((ends - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        window.clearInterval(intervalId);
        submitRef.current(true);
      }
    };
    const id = window.setInterval(() => tick(id), 1000);
    tick(id);
    return () => window.clearInterval(id);
  }, [assessmentId, durationMinutes, startedAt]);

  async function submit(auto = false) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            questionId: q.id,
            response: answersRef.current[q.id] ?? "",
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Submit failed");
      toast.success(auto ? "Time is up — your answers were submitted" : `Submitted. Score ${data.score}/${data.maxMarks}`);
      router.push("/student/exams");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  submitRef.current = (auto) => {
    void submit(auto);
  };

  const mins = remaining == null ? null : Math.floor(remaining / 60);
  const secs = remaining == null ? null : remaining % 60;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {mins != null && secs != null ? (
          <p className="text-sm font-medium text-primary">
            Time left {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
        ) : null}
      </div>
      {questions.map((question, index) => {
        const options = asOptions(question.options);
        return (
          <Card key={question.id}>
            <CardContent className="p-4 space-y-3">
              <p className="font-medium">
                {index + 1}. {question.prompt}{" "}
                <span className="text-xs text-muted">({question.points} marks)</span>
              </p>
              {question.type === "SHORT_ANSWER" ? (
                <textarea
                  className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  rows={3}
                  value={answers[question.id] ?? ""}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  {(options.length ? options : question.type === "TRUE_FALSE" ? ["True", "False"] : []).map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => updateAnswer(question.id, option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit exam"}
      </Button>
    </form>
  );
}
