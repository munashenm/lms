"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface ConflictItem {
  slotId: string;
  conflicts: { type: string; message: string }[];
}

export function TimetableConflicts({ classId }: { classId?: string }) {
  const [items, setItems] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = classId
      ? `/api/timetable/conflicts?classId=${encodeURIComponent(classId)}`
      : "/api/timetable/conflicts";
    fetch(url)
      .then((r) => r.json())
      .then((data) => setItems(data.conflicts ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [classId]);

  if (loading || items.length === 0) return null;

  return (
    <Card className="border-warning/50 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Timetable Conflicts ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.slotId} className="text-sm text-amber-900">
            {item.conflicts.map((c, i) => (
              <p key={i}>· {c.message}</p>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
