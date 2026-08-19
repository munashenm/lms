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

export function CurriculumTopicForm({
  subjects,
  classes,
}: {
  subjects: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/curriculum-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: form.get("subjectId"),
          classId: form.get("classId") || null,
          title: form.get("title"),
          description: form.get("description") || null,
          status: form.get("status"),
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Topic saved");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      toast.error("Could not save topic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add curriculum topic</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select name="subjectId" required>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class (optional)</Label>
              <Select name="classId">
                <option value="">Whole grade / unspecified</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
          <div className="space-y-2"><Label>Description</Label><Input name="description" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="PLANNED">
                <option value="PLANNED">Upcoming</option>
                <option value="CURRENT">Current</option>
                <option value="COMPLETED">Completed</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order</Label>
              <Input name="sortOrder" type="number" defaultValue={0} />
            </div>
          </div>
          <Button type="submit" disabled={loading || subjects.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add topic
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
