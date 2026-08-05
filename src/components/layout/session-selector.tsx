"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SessionOption } from "@/lib/academic-session-shared";
import { SESSION_STATUS_LABELS } from "@/lib/academic-session-shared";

interface SessionSelectorProps {
  sessions: SessionOption[];
  viewSessionId: string | null;
}

export function SessionSelector({ sessions, viewSessionId }: SessionSelectorProps) {
  const router = useRouter();

  if (sessions.length === 0) return null;

  async function onChange(academicYearId: string) {
    try {
      const res = await fetch("/api/session-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Could not switch academic session");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="academic-session" className="text-xs text-muted hidden sm:inline whitespace-nowrap">
        Academic Session
      </label>
      <select
        id="academic-session"
        className="h-9 max-w-[10rem] sm:max-w-[12rem] rounded-lg border border-border bg-background px-2 text-sm"
        value={viewSessionId ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.isCurrent ? " · Current" : ` · ${SESSION_STATUS_LABELS[s.status]}`}
          </option>
        ))}
      </select>
    </div>
  );
}
