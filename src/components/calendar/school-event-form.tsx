"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function SchoolEventForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/school/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description") || "",
          startsAt: form.get("startsAt"),
          endsAt: form.get("endsAt") || undefined,
          isPublic: form.get("isPublic") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Event added");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      toast.error("Could not save event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add calendar event</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Title</Label>
            <Input name="title" required placeholder="Open day" />
          </div>
          <div className="space-y-2">
            <Label>Starts</Label>
            <Input name="startsAt" type="datetime-local" required />
          </div>
          <div className="space-y-2">
            <Label>Ends</Label>
            <Input name="endsAt" type="datetime-local" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <textarea
              name="description"
              rows={3}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 rounded" />
            Show on the public website
          </label>
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save event"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
