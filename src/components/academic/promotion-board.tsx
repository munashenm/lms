"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Check = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  gradeName: string | null;
  className: string | null;
  average: number | null;
  attendancePercent: number | null;
  resultStatus: string;
  eligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "REVIEW_REQUIRED";
  reasons: string[];
};

const OUTCOMES = [
  "PROMOTED",
  "REPEATED",
  "PROGRESSED",
  "GRADUATED",
  "COMPLETED",
  "TRANSFERRED",
  "WITHDRAWN",
  "DEFERRED",
] as const;

export function PromotionBoard({
  years,
  grades,
  classes,
  initialYearId,
  initialGradeId,
}: {
  years: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string; gradeId: string | null }>;
  initialYearId: string;
  initialGradeId: string;
}) {
  const router = useRouter();
  const [fromYearId, setFromYearId] = useState(initialYearId);
  const [toYearId, setToYearId] = useState(years.find((year) => year.id !== initialYearId)?.id ?? "");
  const [gradeId, setGradeId] = useState(initialGradeId);
  const [toGradeId, setToGradeId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [rows, setRows] = useState<Check[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState({ total: 0, eligible: 0, notEligible: 0, review: 0 });
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const targetClasses = useMemo(
    () => classes.filter((item) => !toGradeId || item.gradeId === toGradeId),
    [classes, toGradeId]
  );

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: fromYearId });
      if (gradeId) params.set("gradeId", gradeId);
      const res = await fetch(`/api/promotion?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Could not load promotion list");
        return;
      }
      setRows(json.students);
      setSummary(json.summary);
      setSelected(new Set(json.students.filter((row: Check) => row.eligibility === "ELIGIBLE").map((row: Check) => row.studentId)));
    } finally {
      setLoading(false);
    }
  }

  async function promote(studentId: string, outcome: string, override = false) {
    const res = await fetch("/api/promotion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        fromAcademicYearId: fromYearId,
        toAcademicYearId: toYearId,
        toGradeId,
        toClassId,
        outcome,
        override,
        overrideReason,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.message ?? "Promotion failed");
      return false;
    }
    return true;
  }

  async function promoteRows(chosen: Check[]) {
    let ok = 0;
    for (const row of chosen) {
      const override = row.eligibility !== "ELIGIBLE";
      if (override && !overrideReason.trim()) {
        toast.error("Override reason is required for students who are not eligible");
        return;
      }
      if (await promote(row.studentId, "PROMOTED", override)) ok += 1;
    }
    toast.success(`Promoted ${ok} learner(s)`);
    router.refresh();
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid md:grid-cols-4 gap-3 pt-6">
          <div>
            <Label>From session</Label>
            <Select value={fromYearId} onChange={(e) => setFromYearId(e.target.value)}>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Current grade</Label>
            <Select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">All grades</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>To session</Label>
            <Select value={toYearId} onChange={(e) => setToYearId(e.target.value)}>
              <option value="">Select...</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Destination grade</Label>
            <Select value={toGradeId} onChange={(e) => setToGradeId(e.target.value)}>
              <option value="">Select...</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Destination class</Label>
            <Select value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
              <option value="">Optional</option>
              {targetClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={load} disabled={loading || !fromYearId}>Load class</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge>{summary.total} Students</Badge>
        <Badge variant="success">{summary.eligible} Eligible</Badge>
        <Badge variant="danger">{summary.notEligible} Not Eligible</Badge>
        <Badge variant="warning">{summary.review} Requires Review</Badge>
        <a
          className="text-primary font-medium"
          href={`/api/promotion/report?academicYearId=${fromYearId}&gradeId=${gradeId}&format=csv`}
        >
          Export CSV
        </a>
        <a
          className="text-primary font-medium"
          href={`/api/promotion/report?academicYearId=${fromYearId}&gradeId=${gradeId}&format=pdf`}
        >
          Export PDF
        </a>
      </div>

      <div className="space-y-2">
        <Label>Override reason (required for exceptions)</Label>
        <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            if (!toYearId || !toGradeId) {
              toast.error("Select the destination session and grade first");
              return;
            }
            void promoteRows(rows.filter((row) => row.eligibility === "ELIGIBLE"));
          }}
          disabled={!rows.some((row) => row.eligibility === "ELIGIBLE")}
        >
          Promote Eligible Students
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void promoteRows(rows.filter((row) => selected.has(row.studentId)))}
          disabled={!selected.size}
        >
          Promote selected
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSelected(
              new Set(rows.filter((row) => row.eligibility !== "ELIGIBLE").map((row) => row.studentId))
            );
          }}
        >
          Review Exceptions
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-3 py-2"></th>
                <th className="text-left px-3 py-2">Student</th>
                <th className="text-left px-3 py-2">Average</th>
                <th className="text-left px-3 py-2">Attendance</th>
                <th className="text-left px-3 py-2">Result</th>
                <th className="text-left px-3 py-2">Promotion</th>
                <th className="text-left px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.studentId)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(row.studentId);
                        else next.delete(row.studentId);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.studentName}</p>
                    <p className="text-xs text-muted">{row.studentNumber}</p>
                  </td>
                  <td className="px-3 py-2">{row.average ?? "—"}</td>
                  <td className="px-3 py-2">{row.attendancePercent ?? "—"}%</td>
                  <td className="px-3 py-2">{row.resultStatus}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.eligibility === "ELIGIBLE" ? "success" : row.eligibility === "NOT_ELIGIBLE" ? "danger" : "warning"}>
                      {row.eligibility === "ELIGIBLE" ? "Eligible" : row.eligibility === "NOT_ELIGIBLE" ? "Not Eligible" : "Review Required"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      defaultValue="PROMOTED"
                      onChange={async (e) => {
                        const outcome = e.target.value;
                        const override = row.eligibility !== "ELIGIBLE" && outcome === "PROMOTED";
                        if (await promote(row.studentId, outcome, override)) {
                          toast.success("Promotion recorded");
                          await load();
                        }
                      }}
                    >
                      {OUTCOMES.map((outcome) => (
                        <option key={outcome} value={outcome}>{outcome}</option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <CardContent className="py-10 text-center text-muted">Load a grade to review promotion.</CardContent> : null}
      </Card>
    </div>
  );
}
