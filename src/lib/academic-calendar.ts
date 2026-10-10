export type CalendarKind = "EXAM" | "DEADLINE" | "EVENT";

export interface CalendarEntry {
  date: Date | string;
  label: string;
  detail?: string | null;
  kind: CalendarKind;
}

const HIGHLIGHT_MS = 7 * 24 * 60 * 60 * 1000;

export function calendarKindForAssessment(type: string | null | undefined): CalendarKind {
  if (type === "EXAM" || type === "TEST") return "EXAM";
  if (type === "ASSIGNMENT" || type === "PROJECT" || type === "PRACTICAL" || type === "ORAL") return "DEADLINE";
  return "EVENT";
}

export function isHighlightedCalendarDate(date: Date | string, now = new Date()): boolean {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return false;
  const delta = value.getTime() - now.getTime();
  return delta >= 0 && delta <= HIGHLIGHT_MS;
}

export function groupCalendarEntries(entries: CalendarEntry[]): Array<{ kind: CalendarKind; title: string; entries: CalendarEntry[] }> {
  const order: Array<{ kind: CalendarKind; title: string }> = [
    { kind: "EXAM", title: "Examinations" },
    { kind: "DEADLINE", title: "Deadlines" },
    { kind: "EVENT", title: "Institutional events" },
  ];
  return order
    .map((group) => ({
      ...group,
      entries: entries
        .filter((entry) => entry.kind === group.kind)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }))
    .filter((group) => group.entries.length > 0);
}
