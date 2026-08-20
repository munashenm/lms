"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export type SchoolEventRow = {
  id: string;
  title: string;
  startsAt: string | Date;
  isPublic: boolean;
};

export function SchoolEventList({ events }: { events: SchoolEventRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Remove this calendar event?")) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/school/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not remove event");
      }
      toast.success("Event removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove event");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No events yet.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-muted">
                  {formatDate(event.startsAt)}
                  {event.isPublic ? " · Public" : " · Internal"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void remove(event.id)}
                disabled={loadingId === event.id}
              >
                {loadingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
