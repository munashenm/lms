"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExamSitForm } from "./exam-sit-form";
import { Loader2 } from "lucide-react";

export function ExamSitGate({
  assessmentId,
  title,
  durationMinutes,
}: {
  assessmentId: string;
  title: string;
  durationMinutes?: number | null;
}) {
  const [session, setSession] = useState<{
    startedAt: string;
    questions: Array<{
      id: string;
      prompt: string;
      type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
      options: unknown;
      points: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${assessmentId}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not start exam");
      setSession({
        startedAt: data.attempt.startedAt,
        questions: data.questions,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start exam");
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return (
      <ExamSitForm
        assessmentId={assessmentId}
        title={title}
        durationMinutes={durationMinutes}
        questions={session.questions}
        startedAt={session.startedAt}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted">
        You can submit this paper once. {durationMinutes ? `You will have ${durationMinutes} minutes.` : "There is no timed limit."}
      </p>
      <Button onClick={() => void start()} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start exam"}
      </Button>
    </div>
  );
}
