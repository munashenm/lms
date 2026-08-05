"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SESSION_STATUS_LABELS, PERIOD_STATUS_LABELS } from "@/lib/academic-session";
import type { Terminology } from "@/lib/terminology";

type TermRow = {
  id: string;
  name: string;
  termNumber: number;
  startDate: string;
  endDate: string;
  status: keyof typeof PERIOD_STATUS_LABELS;
  isCurrent: boolean;
  resultsPublishingDate: string | null;
  attendanceStartDate: string | null;
  attendanceEndDate: string | null;
};

type SessionRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: keyof typeof SESSION_STATUS_LABELS;
  isCurrent: boolean;
  terms: TermRow[];
  _count?: { enrolments: number; classes: number };
};

interface AcademicSessionManagerProps {
  schoolId: string;
  sessions: SessionRow[];
  terms: Terminology;
  periodLabel: string;
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function statusVariant(status: string): "default" | "success" | "warning" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (status === "PLANNED") return "default";
  if (status === "CLOSED") return "warning";
  return "secondary";
}

export function AcademicSessionManager({
  schoolId,
  sessions,
  terms,
  periodLabel,
}: AcademicSessionManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    sessions.find((s) => s.isCurrent)?.id ?? sessions[0]?.id ?? null
  );

  async function createSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create-session");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: form.get("name"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          status: form.get("status") || "PLANNED",
          createDefaultPeriods: form.get("createDefaultPeriods") === "on",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      toast.success("Academic session created");
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(null);
    }
  }

  async function sessionAction(id: string, action: string) {
    setLoading(`${action}-${id}`);
    try {
      const res = await fetch(`/api/academic-years/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      toast.success(`Session ${action.replace("_", " ")}d`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  async function createPeriod(e: React.FormEvent<HTMLFormElement>, academicYearId: string) {
    e.preventDefault();
    setLoading(`create-period-${academicYearId}`);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId,
          name: form.get("name"),
          termNumber: form.get("termNumber"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          resultsPublishingDate: form.get("resultsPublishingDate") || null,
          attendanceStartDate: form.get("attendanceStartDate") || null,
          attendanceEndDate: form.get("attendanceEndDate") || null,
          setCurrent: form.get("setCurrent") === "on",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      toast.success(`${periodLabel} created`);
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create period");
    } finally {
      setLoading(null);
    }
  }

  async function periodAction(id: string, action: string) {
    setLoading(`${action}-${id}`);
    try {
      const res = await fetch(`/api/terms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${periodLabel} updated`);
      router.refresh();
    } catch {
      toast.error("Period update failed");
    } finally {
      setLoading(null);
    }
  }

  async function savePeriodDates(e: React.FormEvent<HTMLFormElement>, termId: string) {
    e.preventDefault();
    setLoading(`save-${termId}`);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/terms/${termId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          resultsPublishingDate: form.get("resultsPublishingDate") || null,
          attendanceStartDate: form.get("attendanceStartDate") || null,
          attendanceEndDate: form.get("attendanceEndDate") || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${periodLabel} saved`);
      router.refresh();
    } catch {
      toast.error("Failed to save period");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Academic Session</CardTitle>
          <p className="text-sm text-muted">
            Sessions hold enrolments, {terms.classes.toLowerCase()}, attendance and fees for a year.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={createSession} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" placeholder="2027" required />
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input name="endDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="PLANNED">
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Set as active</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="createDefaultPeriods" defaultChecked className="rounded" />
                Create default {terms.periods.toLowerCase()}
              </label>
              <Button type="submit" disabled={loading === "create-session"}>
                {loading === "create-session" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" /> Create
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sessions.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted">
              No academic sessions yet. Create one to begin enrolment for a year.
            </CardContent>
          </Card>
        )}

        {sessions.map((session) => {
          const expanded = expandedId === session.id;
          return (
            <Card key={session.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{session.name}</CardTitle>
                    <Badge variant={statusVariant(session.status)}>
                      {SESSION_STATUS_LABELS[session.status]}
                    </Badge>
                    {session.isCurrent && <Badge variant="success">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted mt-1">
                    {toDateInput(session.startDate)} → {toDateInput(session.endDate)}
                    {session._count && (
                      <> · {session._count.enrolments} enrolments · {session._count.classes} {terms.classes.toLowerCase()}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {!session.isCurrent && session.status !== "ARCHIVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!loading}
                      onClick={() => sessionAction(session.id, "activate")}
                    >
                      Set active
                    </Button>
                  )}
                  {session.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!loading}
                      onClick={() => sessionAction(session.id, "close")}
                    >
                      Close
                    </Button>
                  )}
                  {(session.status === "CLOSED" || session.status === "ACTIVE") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!loading}
                      onClick={() => sessionAction(session.id, "archive")}
                    >
                      Archive
                    </Button>
                  )}
                  {(session.status === "CLOSED" || session.status === "ARCHIVED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!loading}
                      onClick={() => sessionAction(session.id, "reopen")}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId(expanded ? null : session.id)}
                  >
                    {expanded ? "Hide" : `Manage ${terms.periods}`}
                  </Button>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="space-y-6 border-t border-border pt-4">
                  <div className="space-y-4">
                    {session.terms.map((term) => (
                      <form
                        key={term.id}
                        onSubmit={(e) => savePeriodDates(e, term.id)}
                        className="rounded-lg border border-border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{term.name}</p>
                            <Badge variant={statusVariant(term.status)}>
                              {PERIOD_STATUS_LABELS[term.status]}
                            </Badge>
                            {term.isCurrent && <Badge variant="success">Current</Badge>}
                          </div>
                          <div className="flex gap-2">
                            {!term.isCurrent && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!!loading}
                                onClick={() => periodAction(term.id, "set_current")}
                              >
                                Set current
                              </Button>
                            )}
                            {term.status !== "CLOSED" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={!!loading}
                                onClick={() => periodAction(term.id, "close")}
                              >
                                Close
                              </Button>
                            )}
                            <Button type="submit" size="sm" disabled={loading === `save-${term.id}`}>
                              {loading === `save-${term.id}` && (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input name="name" defaultValue={term.name} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Start</Label>
                            <Input name="startDate" type="date" defaultValue={toDateInput(term.startDate)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End</Label>
                            <Input name="endDate" type="date" defaultValue={toDateInput(term.endDate)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Results publishing</Label>
                            <Input
                              name="resultsPublishingDate"
                              type="date"
                              defaultValue={toDateInput(term.resultsPublishingDate)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Attendance from</Label>
                            <Input
                              name="attendanceStartDate"
                              type="date"
                              defaultValue={toDateInput(term.attendanceStartDate ?? term.startDate)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Attendance to</Label>
                            <Input
                              name="attendanceEndDate"
                              type="date"
                              defaultValue={toDateInput(term.attendanceEndDate ?? term.endDate)}
                            />
                          </div>
                        </div>
                      </form>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => createPeriod(e, session.id)}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end rounded-lg bg-background p-4"
                  >
                    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs">New {periodLabel.toLowerCase()}</Label>
                      <Input name="name" placeholder={`${periodLabel} 1`} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Number</Label>
                      <Input
                        name="termNumber"
                        type="number"
                        min={1}
                        defaultValue={session.terms.length + 1}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start</Label>
                      <Input name="startDate" type="date" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End</Label>
                      <Input name="endDate" type="date" required />
                    </div>
                    <input type="hidden" name="resultsPublishingDate" />
                    <input type="hidden" name="attendanceStartDate" />
                    <input type="hidden" name="attendanceEndDate" />
                    <label className="flex items-center gap-2 text-xs sm:col-span-2">
                      <input type="checkbox" name="setCurrent" className="rounded" />
                      Set as current {periodLabel.toLowerCase()}
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={loading === `create-period-${session.id}`}
                    >
                      Add {periodLabel}
                    </Button>
                  </form>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
