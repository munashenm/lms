import { Card, CardContent } from "@/components/ui/card";
import { DAY_LABELS, DAYS_ORDER } from "@/lib/portal-data";

interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  subject?: { name: string; code: string } | null;
  module?: { name: string; code: string } | null;
  teacher?: { firstName: string; lastName: string } | null;
  class?: { name: string } | null;
}

interface TimetableGridProps {
  slots: TimetableSlot[];
  showClass?: boolean;
}

export function TimetableGrid({ slots, showClass = false }: TimetableGridProps) {
  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted text-sm">
          No timetable slots scheduled yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {DAYS_ORDER.map((day) => {
        const daySlots = slots.filter((s) => s.dayOfWeek === day);
        if (daySlots.length === 0) return null;
        return (
          <Card key={day}>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 text-primary">
                {DAY_LABELS[day]}
              </h3>
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {slot.subject?.name ?? slot.module?.name ?? "Period"}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {slot.startTime} – {slot.endTime}
                      {slot.room && ` · ${slot.room}`}
                    </p>
                    {showClass && slot.class && (
                      <p className="text-xs text-muted">{slot.class.name}</p>
                    )}
                    {slot.teacher && (
                      <p className="text-xs text-muted">
                        {slot.teacher.firstName} {slot.teacher.lastName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
