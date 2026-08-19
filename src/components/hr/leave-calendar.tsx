"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface LeaveDay {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  type: string;
  status: string;
  name: string;
}

function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function overlaps(day: Date, start: Date, end: Date) {
  const t = day.getTime();
  return t >= new Date(start).setHours(0, 0, 0, 0) && t <= new Date(end).setHours(23, 59, 59, 999);
}

export function LeaveCalendar(props: { requests: LeaveDay[]; year?: number; month?: number }) {
  const now = new Date();
  const year = props.year ?? now.getFullYear();
  const month = props.month ?? now.getMonth();
  const cells = monthCells(year, month);
  const label = new Date(year, month, 1).toLocaleString("en-ZA", { month: "long", year: "numeric" });
  const approved = props.requests.filter((r) => r.status === "APPROVED");

  return (
    <Card>
      <CardHeader><CardTitle>Leave calendar — {label}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-muted font-medium px-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            const date = day ? new Date(year, month, day) : null;
            const onLeave = date ? approved.filter((r) => overlaps(date, new Date(r.startDate), new Date(r.endDate))) : [];
            return (
              <div key={i} className="min-h-16 rounded-md border border-border p-1">
                {day ? <p className="font-medium">{day}</p> : null}
                {onLeave.slice(0, 3).map((r) => (
                  <p key={r.id} className="truncate text-[10px] text-primary">{r.name}</p>
                ))}
                {onLeave.length > 3 ? <p className="text-[10px] text-muted">+{onLeave.length - 3}</p> : null}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">Approved leave only. {approved.length} request(s) in the current view.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {approved.slice(0, 12).map((r) => (
            <li key={r.id}>{r.name} — {r.type} · {formatDate(r.startDate)} to {formatDate(r.endDate)}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
