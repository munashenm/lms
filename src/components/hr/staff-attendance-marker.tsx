"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type StaffAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "ON_LEAVE"
  | "REMOTE";

interface StaffRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  employeeNumber?: string | null;
  department?: string | null;
  onApprovedLeave?: boolean;
}

interface StaffAttendanceMarkerProps {
  date: string;
  staff: StaffRow[];
  existingRecords?: {
    userId: string;
    status: StaffAttendanceStatus;
    checkIn?: string | null;
  }[];
}

const STATUS_OPTIONS: {
  value: StaffAttendanceStatus;
  label: string;
  variant: "success" | "danger" | "warning" | "secondary" | "default";
}[] = [
  { value: "PRESENT", label: "Present", variant: "success" },
  { value: "ABSENT", label: "Absent", variant: "danger" },
  { value: "LATE", label: "Late", variant: "warning" },
  { value: "ON_LEAVE", label: "On leave", variant: "secondary" },
  { value: "REMOTE", label: "Remote", variant: "default" },
];

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StaffAttendanceMarker({
  date,
  staff,
  existingRecords = [],
}: StaffAttendanceMarkerProps) {
  const initial: Record<string, StaffAttendanceStatus> = {};
  staff.forEach((s) => {
    const existing = existingRecords.find((r) => r.userId === s.id);
    if (existing) {
      initial[s.id] = existing.status;
    } else if (s.onApprovedLeave) {
      initial[s.id] = "ON_LEAVE";
    } else {
      initial[s.id] = "PRESENT";
    }
  });

  const [statuses, setStatuses] = useState(initial);
  const [loading, setLoading] = useState(false);
  const draftKey = `draft-staff-attendance-${date}`;
  const { lastSaved, hasDraft, restoreDraft, clearDraft } = useDraftAutosave(
    draftKey,
    statuses
  );

  useEffect(() => {
    const draft = restoreDraft();
    if (draft && Object.keys(draft).length > 0) {
      setStatuses(draft);
      toast.info("Restored unsaved staff attendance draft");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function setAll(status: StaffAttendanceStatus) {
    const next: Record<string, StaffAttendanceStatus> = {};
    staff.forEach((s) => {
      next[s.id] = s.onApprovedLeave && status !== "REMOTE" ? "ON_LEAVE" : status;
    });
    setStatuses(next);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: staff.map((s) => ({
            userId: s.id,
            status: statuses[s.id],
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      clearDraft();
      toast.success("Staff attendance saved");
    } catch {
      toast.error("Failed to save staff attendance");
    } finally {
      setLoading(false);
    }
  }

  const presentCount = Object.values(statuses).filter(
    (s) => s === "PRESENT" || s === "REMOTE"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          <p>
            {presentCount} of {staff.length} present or remote
          </p>
          {(hasDraft || lastSaved) && (
            <p className="text-xs text-warning mt-0.5">
              Draft saved locally
              {lastSaved ? ` · ${lastSaved.toLocaleTimeString()}` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
            Mark all present
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save attendance"
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Staff member</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {roleLabel(member.role)}
                        {member.employeeNumber ? ` · ${member.employeeNumber}` : ""}
                        {member.department ? ` · ${member.department}` : ""}
                      </p>
                      {member.onApprovedLeave && (
                        <p className="text-xs text-warning mt-0.5">Approved leave today</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setStatuses((prev) => ({
                                ...prev,
                                [member.id]: opt.value,
                              }))
                            }
                          >
                            <Badge
                              variant={
                                statuses[member.id] === opt.value
                                  ? opt.variant
                                  : "secondary"
                              }
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
