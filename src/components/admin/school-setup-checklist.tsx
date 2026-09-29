import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SchoolSetupProgress } from "@/lib/school-setup";

export function SchoolSetupChecklist({ progress }: { progress: SchoolSetupProgress }) {
  if (progress.isComplete) return null;

  const next = progress.steps.find((s) => !s.done) ?? progress.steps[0];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Set up your school</CardTitle>
            <p className="text-sm text-muted mt-1">
              First 10 minutes — {progress.completed} of {progress.total} done
            </p>
          </div>
          {next ? (
            <Button size="sm" asChild>
              <Link href={next.href}>Continue: {next.title}</Link>
            </Button>
          ) : null}
        </div>
        <div
          className="mt-3 h-2 w-full rounded-full bg-border overflow-hidden"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="School setup progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {progress.steps.map((step) => (
          <div
            key={step.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden />
            ) : (
              <Circle className="h-5 w-5 text-muted shrink-0 mt-0.5" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}>
                {step.title}
              </p>
              <p className="text-xs text-muted mt-0.5">{step.description}</p>
            </div>
            {!step.done ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={step.href}>Open</Link>
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
