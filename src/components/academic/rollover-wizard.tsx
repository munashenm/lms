"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ROLLOVER_OUTCOME_LABELS,
  type RolloverOutcome,
} from "@/lib/rollover";
import type { Terminology } from "@/lib/terminology";

type SessionOption = { id: string; name: string; isCurrent: boolean; status: string };
type GradeOption = { id: string; name: string };
type ClassOption = { id: string; name: string; gradeId: string | null };

type PreviewStudent = {
  enrolmentId: string;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  currentGradeId: string | null;
  currentGradeName: string | null;
  currentClassName: string | null;
  courseName: string | null;
  courseId: string | null;
  suggestedOutcome: RolloverOutcome;
  suggestedGradeId: string | null;
  suggestedGradeName: string | null;
  suggestedClassId: string | null;
};

type Decision = {
  enrolmentId: string;
  studentId: string;
  outcome: RolloverOutcome;
  targetGradeId: string | null;
  targetClassId: string | null;
  targetCourseId: string | null;
};

interface RolloverWizardProps {
  schoolId: string;
  sessions: SessionOption[];
  grades: GradeOption[];
  classes: ClassOption[];
  terms: Terminology;
}

const OUTCOMES = Object.keys(ROLLOVER_OUTCOME_LABELS) as RolloverOutcome[];

export function RolloverWizard({
  schoolId,
  sessions,
  grades,
  classes,
  terms,
}: RolloverWizardProps) {
  const router = useRouter();
  const current = sessions.find((s) => s.isCurrent);
  const [sourceYearId, setSourceYearId] = useState(current?.id ?? sessions[0]?.id ?? "");
  const [targetYearId, setTargetYearId] = useState(
    sessions.find((s) => s.id !== current?.id)?.id ?? ""
  );
  const [filterGradeId, setFilterGradeId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [students, setStudents] = useState<PreviewStudent[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [closeSource, setCloseSource] = useState(true);
  const [activateTarget, setActivateTarget] = useState(true);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const targetSessions = useMemo(
    () => sessions.filter((s) => s.id !== sourceYearId),
    [sessions, sourceYearId]
  );

  async function loadPreview() {
    if (!sourceYearId || !targetYearId) {
      toast.error("Select source and target sessions");
      return;
    }
    setLoading("preview");
    try {
      const res = await fetch("/api/rollover/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          sourceYearId,
          targetYearId,
          gradeId: filterGradeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Preview failed");

      setStudents(data.students);
      const next: Record<string, Decision> = {};
      for (const s of data.students as PreviewStudent[]) {
        next[s.enrolmentId] = {
          enrolmentId: s.enrolmentId,
          studentId: s.studentId,
          outcome: s.suggestedOutcome,
          targetGradeId: s.suggestedGradeId,
          targetClassId: s.suggestedClassId,
          targetCourseId: s.courseId,
        };
      }
      setDecisions(next);
      setStep(2);
      setSummary(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(null);
    }
  }

  function updateDecision(enrolmentId: string, patch: Partial<Decision>) {
    setDecisions((prev) => ({
      ...prev,
      [enrolmentId]: { ...prev[enrolmentId], ...patch },
    }));
  }

  function applyBulkOutcome(outcome: RolloverOutcome) {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of students) {
        const current = next[s.enrolmentId];
        next[s.enrolmentId] = {
          ...current,
          outcome,
          targetGradeId:
            outcome === "PROMOTED"
              ? s.suggestedGradeId
              : outcome === "REPEATED"
                ? s.currentGradeId
                : null,
          targetClassId:
            outcome === "PROMOTED" || outcome === "REPEATED"
              ? current?.targetClassId ?? s.suggestedClassId
              : null,
        };
      }
      return next;
    });
  }

  async function commit() {
    setLoading("commit");
    try {
      const res = await fetch("/api/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          sourceYearId,
          targetYearId,
          closeSource,
          activateTarget,
          decisions: Object.values(decisions),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rollover failed");
      setSummary(data.summary);
      setStep(3);
      toast.success("Rollover completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollover failed");
    } finally {
      setLoading(null);
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of Object.values(decisions)) {
      result[d.outcome] = (result[d.outcome] ?? 0) + 1;
    }
    return result;
  }, [decisions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant={step === 1 ? "default" : "secondary"}>1. Select sessions</Badge>
        <Badge variant={step === 2 ? "default" : "secondary"}>2. Review decisions</Badge>
        <Badge variant={step === 3 ? "success" : "secondary"}>3. Done</Badge>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose sessions</CardTitle>
            <p className="text-sm text-muted">
              Move {terms.students.toLowerCase()} from one academic session into the next.
              Historical records stay on the source year.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From session</Label>
              <Select
                value={sourceYearId}
                onChange={(e) => {
                  setSourceYearId(e.target.value);
                  if (e.target.value === targetYearId) setTargetYearId("");
                }}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To session</Label>
              <Select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)}>
                <option value="">Select target session</option>
                {targetSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filter by {terms.grade.toLowerCase()} (optional)</Label>
              <Select value={filterGradeId} onChange={(e) => setFilterGradeId(e.target.value)}>
                <option value="">All {terms.grades.toLowerCase()}</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadPreview} disabled={!!loading || !targetYearId}>
                {loading === "preview" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Load {terms.students.toLowerCase()}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {students.length} {terms.students.toLowerCase()} ready to process
                </CardTitle>
                <p className="text-sm text-muted mt-1">
                  {Object.entries(counts)
                    .map(([k, v]) => `${v} ${ROLLOVER_OUTCOME_LABELS[k as RolloverOutcome]}`)
                    .join(" · ") || "No decisions yet"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {OUTCOMES.map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant="outline"
                  onClick={() => applyBulkOutcome(outcome)}
                >
                  Set all: {ROLLOVER_OUTCOME_LABELS[outcome]}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-3 font-medium">{terms.student}</th>
                    <th className="px-4 py-3 font-medium">Current</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium">Target {terms.grade}</th>
                    <th className="px-4 py-3 font-medium">Target {terms.classLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        No active enrolments found for this session filter.
                      </td>
                    </tr>
                  )}
                  {students.map((s) => {
                    const d = decisions[s.enrolmentId];
                    const needsPlacement =
                      d?.outcome === "PROMOTED" || d?.outcome === "REPEATED";
                    const classChoices = classes.filter(
                      (c) => !d?.targetGradeId || c.gradeId === d.targetGradeId || !c.gradeId
                    );
                    return (
                      <tr key={s.enrolmentId} className="border-b border-border align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {s.lastName}, {s.firstName}
                          </p>
                          <p className="text-xs text-muted">{s.studentNumber}</p>
                          {s.courseName && (
                            <p className="text-xs text-muted mt-0.5">{s.courseName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {s.currentGradeName ?? "—"}
                          {s.currentClassName ? ` / ${s.currentClassName}` : ""}
                        </td>
                        <td className="px-4 py-3 min-w-[10rem]">
                          <Select
                            value={d?.outcome ?? "PROMOTED"}
                            onChange={(e) =>
                              updateDecision(s.enrolmentId, {
                                outcome: e.target.value as RolloverOutcome,
                                targetGradeId:
                                  e.target.value === "PROMOTED"
                                    ? s.suggestedGradeId
                                    : e.target.value === "REPEATED"
                                      ? s.currentGradeId
                                      : null,
                              })
                            }
                          >
                            {OUTCOMES.map((o) => (
                              <option key={o} value={o}>
                                {ROLLOVER_OUTCOME_LABELS[o]}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-4 py-3 min-w-[9rem]">
                          {needsPlacement ? (
                            <Select
                              value={d?.targetGradeId ?? ""}
                              onChange={(e) =>
                                updateDecision(s.enrolmentId, {
                                  targetGradeId: e.target.value || null,
                                  targetClassId: null,
                                })
                              }
                            >
                              <option value="">Select…</option>
                              {grades.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[9rem]">
                          {needsPlacement ? (
                            <Select
                              value={d?.targetClassId ?? ""}
                              onChange={(e) =>
                                updateDecision(s.enrolmentId, {
                                  targetClassId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Assign later</option>
                              {classChoices.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {students.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={closeSource}
                    onChange={(e) => setCloseSource(e.target.checked)}
                    className="rounded"
                  />
                  Close source session after rollover
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activateTarget}
                    onChange={(e) => setActivateTarget(e.target.checked)}
                    className="rounded"
                  />
                  Set target session as the active/current session
                </label>
                <Button onClick={commit} disabled={!!loading}>
                  {loading === "commit" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm rollover
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {step === 3 && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rollover complete</CardTitle>
            <p className="text-sm text-muted">
              Source session history was preserved. New enrolments were created only for promoted
              and repeating {terms.students.toLowerCase()}.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Processed: {summary.processed}</p>
            <p>Promoted: {summary.promoted}</p>
            <p>Repeated: {summary.repeated}</p>
            <p>Graduated: {summary.graduated}</p>
            <p>Completed programme: {summary.completed}</p>
            <p>Withdrawn: {summary.withdrawn}</p>
            <p>Transferred: {summary.transferred}</p>
            {(summary.skippedExistingTarget ?? 0) > 0 && (
              <p className="text-muted">
                Skipped existing target enrolments: {summary.skippedExistingTarget}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button asChild>
                <Link href="/admin/academic">Back to sessions</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setStudents([]);
                  setDecisions({});
                  setSummary(null);
                }}
              >
                Run another rollover
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
