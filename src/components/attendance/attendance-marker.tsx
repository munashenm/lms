"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

interface AttendanceMarkerProps {
  classId: string;
  date: string;
  students: StudentRow[];
  existingRecords?: { studentId: string; status: AttendanceStatus }[];
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; variant: "success" | "danger" | "warning" | "secondary" }[] = [
  { value: "PRESENT", label: "Present", variant: "success" },
  { value: "ABSENT", label: "Absent", variant: "danger" },
  { value: "LATE", label: "Late", variant: "warning" },
  { value: "EXCUSED", label: "Excused", variant: "secondary" },
];

export function AttendanceMarker({
  classId,
  date,
  students,
  existingRecords = [],
}: AttendanceMarkerProps) {
  const initial: Record<string, AttendanceStatus> = {};
  students.forEach((s) => {
    const existing = existingRecords.find((r) => r.studentId === s.id);
    initial[s.id] = existing?.status ?? "PRESENT";
  });

  const [statuses, setStatuses] = useState(initial);
  const [loading, setLoading] = useState(false);
  const draftKey = `draft-attendance-${classId}-${date}`;
  const { lastSaved, hasDraft, restoreDraft, clearDraft } = useDraftAutosave(draftKey, statuses);

  useEffect(() => {
    const draft = restoreDraft();
    if (draft && Object.keys(draft).length > 0) {
      setStatuses(draft);
      toast.info("Restored unsaved attendance draft");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { next[s.id] = status; });
    setStatuses(next);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          date,
          records: students.map((s) => ({
            studentId: s.id,
            status: statuses[s.id],
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

  const presentCount = Object.values(statuses).filter((s) => s === "PRESENT").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          <p>{presentCount} of {students.length} present</p>
          {(hasDraft || lastSaved) && (
            <p className="text-xs text-warning mt-0.5">
              Draft saved locally{lastSaved ? ` · ${lastSaved.toLocaleTimeString()}` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
            Mark all present
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save attendance"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
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
                              variant={statuses[student.id] === opt.value ? opt.variant : "secondary"}
                              className="cursor-pointer"
                            >
                              {opt.label}
                            </Badge>
                          </button>
                        ))}
                      </div>
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
