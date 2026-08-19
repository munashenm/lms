"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Opt {
  id: string;
  name: string;
}

interface StudentOpt {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

export function NoticeComposeForm({
  students,
  grades,
  classes,
}: {
  students: StudentOpt[];
  grades: Opt[];
  classes: Opt[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [audience, setAudience] = useState("PARENTS");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: form.get("channel"),
          category: form.get("category"),
          audience: form.get("audience"),
          studentId: form.get("studentId") || null,
          classId: form.get("classId") || null,
          gradeId: form.get("gradeId") || null,
          subject: form.get("subject"),
          message: form.get("message"),
          processImmediately: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not send notice");
        return;
      }
      const remaining = json.processResult?.remaining ?? json.batch?.queuedCount ?? 0;
      toast.success(
        remaining > 0
          ? `Notice queued. ${remaining} still sending — refresh the log shortly.`
          : "Notice sent. Check the log below for delivery status."
      );
      e.currentTarget.reset();
      setAudience("PARENTS");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compose notice</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="audience">Audience</Label>
              <Select
                id="audience"
                name="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="PARENTS">All parents</option>
                <option value="STUDENTS">All students</option>
                <option value="STAFF">Staff</option>
                <option value="GRADE">A grade</option>
                <option value="CLASS">A class</option>
                <option value="STUDENT">One student / family</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="channel">Channel</Label>
              <Select id="channel" name="channel" defaultValue="EMAIL">
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Email and SMS</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="GENERAL">
                <option value="GENERAL">General</option>
                <option value="ACADEMIC_NOTICE">Academic notice</option>
                <option value="EXAM_NOTICE">Exam notice</option>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="EMERGENCY">Emergency</option>
              </Select>
            </div>
          </div>

          {audience === "STUDENT" ? (
            <div className="space-y-1">
              <Label htmlFor="studentId">Student</Label>
              <Select id="studentId" name="studentId" required>
                <option value="">Select...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName}, {s.firstName} ({s.studentNumber})
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {audience === "GRADE" ? (
            <div className="space-y-1">
              <Label htmlFor="gradeId">Grade</Label>
              <Select id="gradeId" name="gradeId" required>
                <option value="">Select...</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </div>
          ) : null}
          {audience === "CLASS" ? (
            <div className="space-y-1">
              <Label htmlFor="classId">Class</Label>
              <Select id="classId" name="classId" required>
                <option value="">Select...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required placeholder="School notice" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Use {{firstName}} and {{lastName}} to personalise."
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send notice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
