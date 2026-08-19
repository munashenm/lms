"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

interface AttendanceMarkerProps {
  classId?: string | null;
  moduleId?: string | null;
  subjectId?: string | null;
  sessionStart?: string | null;
  sessionEnd?: string | null;
  date: string;
  students: StudentRow[];
  existingRecords?: {
    studentId: string;
    status: AttendanceStatus;
    notes?: string | null;
  }[];
  studentLabel?: string;
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  short: string;
  variant: "success" | "danger" | "warning" | "secondary" | "accent";
}[] = [
  { value: "PRESENT", label: "Present", short: "P", variant: "success" },
  { value: "ABSENT", label: "Absent", short: "A", variant: "danger" },
  { value: "LATE", label: "Late", short: "L", variant: "warning" },
  { value: "EXCUSED", label: "Excused", short: "E", variant: "secondary" },
  { value: "SICK", label: "Sick", short: "S", variant: "accent" },
];

export function AttendanceMarker({
  classId,
  moduleId,
  subjectId,
  sessionStart,
  sessionEnd,
  date,
  students,
  existingRecords = [],
  studentLabel = "Learner",
}: AttendanceMarkerProps) {
  const initialStatus: Record<string, AttendanceStatus> = {};
  const initialNotes: Record<string, string> = {};
  students.forEach((s) => {
    const existing = existingRecords.find((r) => r.studentId === s.id);
    initialStatus[s.id] = existing?.status ?? "PRESENT";
    initialNotes[s.id] = existing?.notes ?? "";
  });

  const [statuses, setStatuses] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const draftKey = `draft-attendance-${classId ?? moduleId ?? "x"}-${date}-${sessionStart ?? ""}`;
  const { lastSaved, hasDraft, restoreDraft, clearDraft } = useDraftAutosave(draftKey, {
    statuses,
    notes,
  });

  useEffect(() => {
    const draft = restoreDraft() as { statuses?: Record<string, AttendanceStatus>; notes?: Record<string, string> } | null;
    if (draft?.statuses && Object.keys(draft.statuses).length > 0) {
      setStatuses(draft.statuses);
      if (draft.notes) setNotes(draft.notes);
      toast.info("Restored unsaved attendance draft");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      next[s.id] = status;
    });
    setStatuses(next);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classId || null,
          moduleId: moduleId || null,
          subjectId: subjectId || null,
          sessionStart: sessionStart || null,
          sessionEnd: sessionEnd || null,
          date,
          records: students.map((s) => ({
            studentId: s.id,
            status: statuses[s.id],
            notes: notes[s.id]?.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      clearDraft();
      toast.success("Attendance saved");
    } catch {
      toast.error("Failed to save attendance");
    } finally {
      setLoading(false);
    }
  }

  const presentCount = Object.values(statuses).filter(
    (s) => s === "PRESENT" || s === "LATE"
  ).length;
  const absentCount = Object.values(statuses).filter((s) => s === "ABSENT" || s === "SICK").length;

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-20 -mx-1 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {presentCount} present · {absentCount} away · {students.length} total
            </p>
            {(hasDraft || lastSaved) && (
              <p className="text-xs text-warning mt-0.5">
                Draft saved locally
                {lastSaved ? ` · ${lastSaved.toLocaleTimeString()}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setAll("PRESENT")}
            >
              Mark all present
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        {students.map((student) => (
          <Card key={student.id}>
            <CardContent className="p-3 space-y-3">
              <div>
                <p className="font-medium">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-muted">{student.studentNumber}</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="min-h-11"
                    onClick={() =>
                      setStatuses((prev) => ({ ...prev, [student.id]: opt.value }))
                    }
                  >
                    <Badge
                      variant={statuses[student.id] === opt.value ? opt.variant : "secondary"}
                      className="w-full justify-center cursor-pointer py-2"
                    >
                      {opt.short}
                    </Badge>
                  </button>
                ))}
              </div>
              {(statuses[student.id] !== "PRESENT" || notes[student.id]) && (
                <Input
                  placeholder="Optional note (e.g. medical appointment)"
                  value={notes[student.id] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                  }
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">{studentLabel}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Notes</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-muted">{student.studentNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setStatuses((prev) => ({ ...prev, [student.id]: opt.value }))
                            }
                          >
                            <Badge
                              variant={
                                statuses[student.id] === opt.value ? opt.variant : "secondary"
                              }
                              className="cursor-pointer"
                            >
                              {opt.label}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[12rem]">
                      {expandedNotes === student.id ||
                      notes[student.id] ||
                      statuses[student.id] !== "PRESENT" ? (
                        <Input
                          placeholder="Optional note"
                          value={notes[student.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                          onBlur={() => setExpandedNotes(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-primary"
                          onClick={() => setExpandedNotes(student.id)}
                        >
                          Add note
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
