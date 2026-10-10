import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { groupCalendarEntries, isHighlightedCalendarDate, type CalendarEntry } from "@/lib/academic-calendar";

export function AcademicCalendarList({ entries }: { entries: CalendarEntry[] }) {
  const groups = groupCalendarEntries(entries);
  if (groups.length === 0) {
    return <p className="text-sm text-muted">Nothing scheduled in the next 60 days.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.kind}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.entries.map((entry, index) => {
              const soon = isHighlightedCalendarDate(entry.date);
              return (
                <div
                  key={`${entry.kind}-${entry.label}-${index}`}
                  className={`flex justify-between gap-3 rounded-md border px-3 py-2 text-sm ${soon ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <div>
                    <p className="font-medium">{entry.label}</p>
                    {entry.detail ? <p className="text-xs text-muted">{entry.detail}</p> : null}
                    {soon ? <p className="text-xs text-primary">Coming up this week</p> : null}
                  </div>
                  <p className="text-muted shrink-0">{formatDate(entry.date)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
