"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EnrolmentServicesForm(props: {
  studentId: string;
  academicYearId: string;
  academicYearName: string;
  gradeId?: string | null;
  classId?: string | null;
  hostel: boolean;
  transport: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hostel, setHostel] = useState(props.hostel);
  const [transport, setTransport] = useState(props.transport);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: props.studentId,
          academicYearId: props.academicYearId,
          gradeId: props.gradeId,
          classId: props.classId,
          hostel,
          transport,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Enrolment services updated. Matching hostel/transport fees apply once.");
      router.refresh();
    } catch {
      toast.error("Could not update hostel/transport flags");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hostel & transport</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted mb-4">
          These flags are stored on the {props.academicYearName} enrolment. Hostel and transport fee
          structures only auto-apply when the matching flag is on.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hostel}
              onChange={(e) => setHostel(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Hostel learner for this academic year</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={transport}
              onChange={(e) => setTransport(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Uses school transport for this academic year</span>
          </label>
          <Button type="submit" disabled={loading}>Save flags</Button>
        </form>
      </CardContent>
    </Card>
  );
}
