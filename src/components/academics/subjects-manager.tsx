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

interface Grade { id: string; name: string }
interface Subject { id: string; code: string; name: string; grade?: { name: string } | null }
interface Module { id: string; code: string; name: string }
interface Course { id: string; code: string; name: string; modules: Module[] }

interface SubjectsManagerProps {
  grades: Grade[];
  subjects: Subject[];
  courses: Course[];
}

export function SubjectsManager({ grades, subjects, courses }: SubjectsManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function submit(endpoint: string, data: Record<string, unknown>, label: string) {
    setLoading(label);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(`${label} created`);
      router.refresh();
    } catch {
      toast.error(`Failed to create ${label}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add Grade</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit("/api/grades", Object.fromEntries(f.entries()), "Grade");
              e.currentTarget.reset();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="g-name">Name</Label>
              <Input id="g-name" name="name" placeholder="Grade 10" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-level">Level</Label>
              <Input id="g-level" name="level" type="number" />
            </div>
            <Button type="submit" size="sm" disabled={loading === "Grade"}>
              {loading === "Grade" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Grade"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Subject</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit("/api/subjects", Object.fromEntries(f.entries()), "Subject");
              e.currentTarget.reset();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="s-code">Code</Label>
              <Input id="s-code" name="code" placeholder="MATH" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-name">Name</Label>
              <Input id="s-name" name="name" placeholder="Mathematics" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-grade">Grade</Label>
              <Select id="s-grade" name="gradeId">
                <option value="">Any</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={loading === "Subject"}>
              {loading === "Subject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Subject"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Course / Module</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit("/api/courses", Object.fromEntries(f.entries()), "Course");
              e.currentTarget.reset();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Course Code</Label>
              <Input name="code" placeholder="IT-001" required />
            </div>
            <div className="space-y-1">
              <Label>Course Name</Label>
              <Input name="name" placeholder="Information Technology" required />
            </div>
            <div className="space-y-1">
              <Label>NQF Level</Label>
              <Input name="nqfLevel" type="number" />
            </div>
            <Button type="submit" size="sm" disabled={loading === "Course"}>
              {loading === "Course" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Course"}
            </Button>
          </form>

          {courses.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const courseId = f.get("courseId") as string;
                submit(`/api/courses/${courseId}/modules`, {
                  code: f.get("code"),
                  name: f.get("name"),
                  credits: f.get("credits"),
                }, "Module");
                e.currentTarget.reset();
              }}
              className="space-y-3 pt-3 border-t border-border"
            >
              <p className="text-xs font-medium text-muted">Add module to course</p>
              <Select name="courseId" required>
                <option value="">Select course...</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input name="code" placeholder="Module code" required />
              <Input name="name" placeholder="Module name" required />
              <Input name="credits" type="number" placeholder="Credits" />
              <Button type="submit" size="sm" variant="outline" disabled={loading === "Module"}>
                {loading === "Module" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Module"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
