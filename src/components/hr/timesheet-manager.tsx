"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface TimesheetRow {
  id: string;
  status: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  totalHours: unknown;
  overtimeHours: unknown;
  employee?: { firstName: string; lastName: string; employeeNumber: string };
}

export function TimesheetManager(props: {
  timesheets: TimesheetRow[];
  employees?: Array<{ id: string; firstName: string; lastName: string; employeeNumber: string }>;
  selfService?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const form = new FormData(e.currentTarget);
    const periodStart = String(form.get("periodStart"));
    const periodEnd = String(form.get("periodEnd"));
    const hours = Number(form.get("hours") || 0);
    const overtimeHours = Number(form.get("overtimeHours") || 0);
    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.get("employeeId") || undefined,
          periodStart,
          periodEnd,
          notes: form.get("notes") || null,
          entries: [{ workDate: periodStart, hours, overtimeHours }],
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Timesheet saved as draft");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save timesheet");
    } finally {
      setLoading(null);
    }
  }

  async function act(id: string, action: "submit" | "approve" | "reject") {
    setLoading(id + action);
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Timesheet ${action}d`);
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setLoading(null);
    }
  }

  async function fromClock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("clock");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/timesheets/from-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: form.get("clockStart"),
          periodEnd: form.get("clockEnd"),
          employeeId: form.get("clockEmployeeId") || undefined,
          fromAttendance: true,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Draft timesheets generated from clock / attendance");
      router.refresh();
    } catch {
      toast.error("Could not import clock hours");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{props.selfService ? "Log hours" : "Capture timesheet"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            {!props.selfService && props.employees ? (
              <div className="sm:col-span-2">
                <Label htmlFor="employeeId">Employee</Label>
                <select id="employeeId" name="employeeId" required className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  {props.employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.lastName}, {e.firstName} ({e.employeeNumber})</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div><Label htmlFor="periodStart">Period start</Label><Input id="periodStart" name="periodStart" type="date" required /></div>
            <div><Label htmlFor="periodEnd">Period end</Label><Input id="periodEnd" name="periodEnd" type="date" required /></div>
            <div><Label htmlFor="hours">Hours</Label><Input id="hours" name="hours" type="number" step="0.25" required /></div>
            <div><Label htmlFor="overtimeHours">Overtime</Label><Input id="overtimeHours" name="overtimeHours" type="number" step="0.25" defaultValue="0" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading === "create"}>Save draft</Button></div>
          </form>
          {!props.selfService ? (
            <form onSubmit={fromClock} className="grid gap-4 sm:grid-cols-2 mt-6 pt-6 border-t border-border">
              <p className="sm:col-span-2 text-sm text-muted">
                Import check-in/out hours from staff attendance or a generic clock payload. Biometric vendors map to the same punches; their native tables are not invented here.
              </p>
              {!props.selfService && props.employees ? (
                <div className="sm:col-span-2">
                  <Label htmlFor="clockEmployeeId">Employee (optional)</Label>
                  <select id="clockEmployeeId" name="clockEmployeeId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                    <option value="">All employees with attendance</option>
                    {props.employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div><Label htmlFor="clockStart">Period start</Label><Input id="clockStart" name="clockStart" type="date" required /></div>
              <div><Label htmlFor="clockEnd">Period end</Label><Input id="clockEnd" name="clockEnd" type="date" required /></div>
              <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={loading === "clock"}>Generate from clock</Button></div>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                {!props.selfService ? <th className="text-left px-4 py-3 font-medium text-muted">Employee</th> : null}
                <th className="text-left px-4 py-3 font-medium text-muted">Period</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Hours</th>
                <th className="text-right px-4 py-3 font-medium text-muted">OT</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.timesheets.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  {!props.selfService ? (
                    <td className="px-4 py-3">{row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : "—"}</td>
                  ) : null}
                  <td className="px-4 py-3">{formatDate(row.periodStart)} – {formatDate(row.periodEnd)}</td>
                  <td className="px-4 py-3 text-right">{Number(row.totalHours)}</td>
                  <td className="px-4 py-3 text-right">{Number(row.overtimeHours)}</td>
                  <td className="px-4 py-3"><Badge>{row.status}</Badge></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {(row.status === "DRAFT") ? (
                      <Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => act(row.id, "submit")}>Submit</Button>
                    ) : null}
                    {!props.selfService && row.status === "PENDING" ? (
                      <>
                        <Button size="sm" disabled={Boolean(loading)} onClick={() => act(row.id, "approve")}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={Boolean(loading)} onClick={() => act(row.id, "reject")}>Reject</Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
