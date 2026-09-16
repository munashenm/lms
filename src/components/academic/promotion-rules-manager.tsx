"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Rule = {
  id: string;
  name: string;
  fromGradeId: string | null;
  toGradeId: string | null;
  minAverage: number | string | null;
  minAttendancePercent: number | string | null;
  requirePassStatus: boolean;
  isActive: boolean;
  fromGrade?: { name: string } | null;
  toGrade?: { name: string } | null;
};

export function PromotionRulesManager({
  rules,
  grades,
}: {
  rules: Rule[];
  grades: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    fromGradeId: "",
    toGradeId: "",
    minAverage: "50",
    minAttendancePercent: "75",
    requirePassStatus: true,
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/promotion/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        minAverage: Number(form.minAverage),
        minAttendancePercent: Number(form.minAttendancePercent),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.message ?? "Could not save rule");
      return;
    }
    toast.success("Promotion rule saved");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/promotion/rules/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete rule");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">New promotion rule</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>From grade</Label>
              <Select value={form.fromGradeId} onChange={(e) => setForm({ ...form, fromGradeId: e.target.value })}>
                <option value="">Any</option>
                {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>To grade</Label>
              <Select value={form.toGradeId} onChange={(e) => setForm({ ...form, toGradeId: e.target.value })}>
                <option value="">Suggested later</option>
                {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Minimum overall result %</Label>
              <Input type="number" value={form.minAverage} onChange={(e) => setForm({ ...form, minAverage: e.target.value })} />
            </div>
            <div>
              <Label>Attendance requirement %</Label>
              <Input type="number" value={form.minAttendancePercent} onChange={(e) => setForm({ ...form, minAttendancePercent: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.requirePassStatus}
                onChange={(e) => setForm({ ...form, requirePassStatus: e.target.checked })}
              />
              Final academic status must be PASS
            </label>
            <Button type="submit">Save rule</Button>
          </form>
        </CardContent>
      </Card>
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="py-4 flex justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">{rule.name}</p>
              <p className="text-muted">
                {rule.fromGrade?.name ?? "Any grade"} → {rule.toGrade?.name ?? "Next grade"} · Average {String(rule.minAverage ?? "—")}% · Attendance {String(rule.minAttendancePercent ?? "—")}%
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => remove(rule.id)}>Delete</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
