"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { percentageToSymbol } from "@/lib/grading";

interface StudentMark {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  existingScore?: number;
  existingSymbol?: string;
}

interface MarksEntryProps {
  assessmentId: string;
  maxMarks: number;
  students: StudentMark[];
}

export function MarksEntry({ assessmentId, maxMarks, students }: MarksEntryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    students.forEach((s) => {
      if (s.existingScore !== undefined) init[s.id] = String(s.existingScore);
    });
    return init;
  });

  const draftKey = `draft-marks-${assessmentId}`;
  const { lastSaved, hasDraft, restoreDraft, clearDraft } = useDraftAutosave(draftKey, scores);

  useEffect(() => {
    const draft = restoreDraft();
    if (draft && Object.keys(draft).length > 0) {
      setScores((prev) => ({ ...prev, ...draft }));
      toast.info("Restored unsaved marks draft");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  async function handleSave() {
    setLoading(true);
    const marks = students
      .filter((s) => scores[s.id] !== undefined && scores[s.id] !== "")
      .map((s) => ({
        studentId: s.id,
        score: parseFloat(scores[s.id]),
      }));

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks }),
      });
      if (!res.ok) throw new Error();
      clearDraft();
      toast.success(`Saved ${marks.length} marks`);
      router.refresh();
    } catch {
      toast.error("Failed to save marks");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted">
          <p>Max marks: {maxMarks}</p>
          {(hasDraft || lastSaved) && (
            <p className="text-xs text-warning">Draft saved locally{lastSaved ? ` · ${lastSaved.toLocaleTimeString()}` : ""}</p>
          )}
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Marks"}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                <th className="text-left px-4 py-3 font-medium text-muted w-32">Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted w-24">%</th>
                <th className="text-left px-4 py-3 font-medium text-muted w-20">Symbol</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const score = parseFloat(scores[student.id] ?? "");
                const pct = !isNaN(score) ? Math.round((score / maxMarks) * 100) : null;
                const symbol = pct !== null ? percentageToSymbol(pct) : null;
                return (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-muted">{student.studentNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        max={maxMarks}
                        step="0.5"
                        value={scores[student.id] ?? ""}
                        onChange={(e) =>
                          setScores((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">{pct !== null ? `${pct}%` : "—"}</td>
                    <td className="px-4 py-3">
                      {symbol && <Badge variant="default">{symbol}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
