"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const DEFAULT_AUDIENCES = [
  { value: "ALL", label: "Everyone" },
  { value: "STUDENTS", label: "Learners" },
  { value: "PARENTS", label: "Parents" },
  { value: "STAFF", label: "Staff" },
  { value: "TEACHERS", label: "Educators" },
] as const;

export function AnnouncementForm({
  audiences = DEFAULT_AUDIENCES,
}: {
  audiences?: ReadonlyArray<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          content: form.get("content"),
          audience: form.get("audience"),
          isPinned: form.get("isPinned") === "on",
          isPublic: form.get("isPublic") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Announcement published");
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Failed to publish announcement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Announcement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <textarea
              id="content"
              name="content"
              required
              rows={4}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select id="audience" name="audience" defaultValue={audiences[0]?.value ?? "ALL"}>
                {audiences.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end pb-1 gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="isPinned" className="h-4 w-4 rounded" />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="isPublic" className="h-4 w-4 rounded" />
                Show on public website
              </label>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
