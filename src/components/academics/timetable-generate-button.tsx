"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TimetableGenerateButton({ classId }: { classId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: classId || null, periodsPerWeek: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Could not generate timetable");
      const missed = Array.isArray(data.unplaced) ? data.unplaced.length : 0;
      toast.success(
        missed
          ? `Added ${data.created} period${data.created === 1 ? "" : "s"}. ${missed} could not be placed without a clash.`
          : `Added ${data.created} period${data.created === 1 ? "" : "s"} with no teacher, class, or room clash.`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Could not generate timetable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={generate} disabled={loading}>
      {loading ? "Generating…" : "Generate from class subjects"}
    </Button>
  );
}
