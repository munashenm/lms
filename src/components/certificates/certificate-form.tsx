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

interface Option { id: string; name: string; studentNumber?: string }

interface CertificateFormProps {
  students: Option[];
  courses: Option[];
  academicYears: Option[];
}

export function CertificateForm({ students, courses, academicYears }: CertificateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Certificate issued");
      router.refresh();
    } catch {
      toast.error("Failed to issue certificate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Issue Certificate</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Student *</Label>
            <Select name="studentId" required>
              <option value="">Select student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.studentNumber && `(${s.studentNumber})`}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select name="type" required defaultValue="COMPLETION">
              <option value="COMPLETION">Completion</option>
              <option value="GRADUATION">Graduation</option>
              <option value="MERIT">Merit</option>
              <option value="ATTENDANCE">Attendance</option>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required placeholder="Certificate of Completion — NQF Level 4" />
          </div>
          <div className="space-y-2">
            <Label>Programme</Label>
            <Select name="courseId">
              <option value="">None</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select name="academicYearId">
              <option value="">None</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" placeholder="For successful completion of all modules..." />
          </div>
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate & Issue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
