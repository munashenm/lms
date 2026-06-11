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
import { DAYS_ORDER, DAY_LABELS } from "@/lib/portal-data";

interface Option { id: string; name: string; code?: string }

interface TimetableFormProps {
  classes: Option[];
  subjects: Option[];
  teachers: { id: string; firstName: string; lastName: string }[];
  defaultClassId?: string;
}

export function TimetableForm({ classes, subjects, teachers, defaultClassId }: TimetableFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      if (!res.ok) throw new Error();
      toast.success("Timetable slot added");
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Failed to add slot");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Timetable Slot</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select name="classId" defaultValue={defaultClassId} required>
              <option value="">Select...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select name="subjectId">
              <option value="">Select...</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select name="teacherId">
              <option value="">Select...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Day *</Label>
            <Select name="dayOfWeek" required>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>{DAY_LABELS[d]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start *</Label>
            <Input name="startTime" type="time" required />
          </div>
          <div className="space-y-2">
            <Label>End *</Label>
            <Input name="endTime" type="time" required />
          </div>
          <div className="space-y-2">
            <Label>Room</Label>
            <Input name="room" placeholder="Lab 101" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Slot"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
