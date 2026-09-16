"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Check = {
  eligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "REVIEW_REQUIRED";
  average: number | null;
  attendancePercent: number | null;
  resultStatus: string;
  reasons: string[];
};

export function StudentPromoteForm({
  studentId,
  years,
  grades,
  classes,
  currentYearId,
  currentGradeName,
}: {
  studentId: string;
  years: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  currentYearId: string;
  currentGradeName: string;
}) {
  const router = useRouter();
  const [fromYearId, setFromYearId] = useState(currentYearId);
  const [toYearId, setToYearId] = useState("");
  const [toGradeId, setToGradeId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCheck() {
    const res = await fetch(`/api/promotion?academicYearId=${fromYearId}&studentId=${studentId}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message ?? "Could not calculate eligibility");
      return;
    }
    setCheck(json.students?.[0] ?? null);
  }

  async function confirm() {
    if (!check) return;
    setLoading(true);
    try {
      const override = check.eligibility !== "ELIGIBLE";
      const res = await fetch("/api/promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          fromAcademicYearId: fromYearId,
          toAcademicYearId: toYearId,
          toGradeId,
          toClassId,
          outcome: "PROMOTED",
          override,
          overrideReason: reason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Promotion failed");
        return;
      }
      toast.success("Promotion recorded");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Promote student</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">Current: {currentGradeName}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>From session</Label>
            <Select value={fromYearId} onChange={(e) => setFromYearId(e.target.value)}>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>To session</Label>
            <Select value={toYearId} onChange={(e) => setToYearId(e.target.value)}>
              <option value="">Select...</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Proposed grade</Label>
            <Select value={toGradeId} onChange={(e) => setToGradeId(e.target.value)}>
              <option value="">Select...</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Proposed class</Label>
            <Select value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
              <option value="">Optional</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={loadCheck}>Check eligibility</Button>
        {check ? (
          <div className="space-y-2 text-sm">
            <Badge variant={check.eligibility === "ELIGIBLE" ? "success" : check.eligibility === "NOT_ELIGIBLE" ? "danger" : "warning"}>
              {check.eligibility === "ELIGIBLE" ? "Eligible for Promotion" : check.eligibility === "NOT_ELIGIBLE" ? "Not Eligible" : "Review Required"}
            </Badge>
            <ul className="list-disc pl-5">
              {check.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            {check.eligibility !== "ELIGIBLE" ? (
              <div>
                <Label>Override reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            ) : null}
            <Button type="button" onClick={confirm} disabled={loading}>Confirm Promotion</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
