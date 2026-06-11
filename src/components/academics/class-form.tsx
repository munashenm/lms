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

interface Option { id: string; name: string }

interface ClassFormProps {
  grades: Option[];
  campuses: Option[];
  academicYears: Option[];
}

export function ClassForm({ grades, campuses, academicYears }: ClassFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      if (!res.ok) throw new Error();
      toast.success("Class created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create class");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Add Class</Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Class</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Class Name *</Label>
            <Input id="name" name="name" placeholder="e.g. IT-4A" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeId">Grade</Label>
            <Select id="gradeId" name="gradeId">
              <option value="">Select...</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campusId">Campus</Label>
            <Select id="campusId" name="campusId">
              <option value="">Select...</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="academicYearId">Academic Year</Label>
            <Select id="academicYearId" name="academicYearId">
              <option value="">Select...</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="room">Room</Label>
            <Input id="room" name="room" placeholder="Lab 101" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" name="capacity" type="number" min="1" />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Class"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
