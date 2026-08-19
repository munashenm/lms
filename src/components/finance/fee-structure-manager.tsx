"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR } from "@/lib/utils";

const SOURCES = [
  "GRADE_FEE",
  "CLASS_FEE",
  "COURSE_FEE",
  "MODULE_FEE",
  "REGISTRATION_FEE",
  "HOSTEL_FEE",
  "TRANSPORT_FEE",
  "MANUAL_CHARGE",
] as const;

const FREQUENCIES = ["ONCE", "MONTHLY", "TERMLY", "SEMESTER", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"] as const;

export interface FeeStructureRow {
  id: string;
  name: string;
  chargeSource: string;
  amount: number;
  billingFrequency: string;
  allowInstalments: boolean;
  isActive: boolean;
}

interface Lookup {
  id: string;
  name: string;
}

export function FeeStructureManager(props: {
  items: FeeStructureRow[];
  grades: Lookup[];
  courses: Lookup[];
  years: Lookup[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/fee-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          amount: Number(form.get("amount")),
          chargeSource: form.get("chargeSource"),
          billingFrequency: form.get("billingFrequency"),
          allowInstalments: form.get("allowInstalments") === "on",
          gradeId: form.get("gradeId") || null,
          courseId: form.get("courseId") || null,
          academicYearId: form.get("academicYearId") || null,
          applyOnEnrolment: form.get("chargeSource") !== "MANUAL_CHARGE" && form.get("chargeSource") !== "HOSTEL_FEE" && form.get("chargeSource") !== "TRANSPORT_FEE",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Fee structure saved");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save fee structure");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New fee structure</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createItem} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Grade 10 annual tuition" />
            </div>
            <div>
              <Label htmlFor="amount">Amount (ZAR)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="chargeSource">Source</Label>
              <select id="chargeSource" name="chargeSource" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="billingFrequency">Billing frequency</Label>
              <select id="billingFrequency" name="billingFrequency" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {FREQUENCIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="allowInstalments" name="allowInstalments" type="checkbox" />
              <Label htmlFor="allowInstalments">Allow instalments (do not auto-split unless checked)</Label>
            </div>
            <div>
              <Label htmlFor="academicYearId">Academic year</Label>
              <select id="academicYearId" name="academicYearId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Any</option>
                {props.years.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="gradeId">Grade</Label>
              <select id="gradeId" name="gradeId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">None</option>
                {props.grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="courseId">Course / programme</Label>
              <select id="courseId" name="courseId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">None</option>
                {props.courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save structure"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Frequency</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Instalments</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{item.chargeSource}</Badge></td>
                  <td className="px-4 py-3 text-muted">{item.billingFrequency}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(item.amount)}</td>
                  <td className="px-4 py-3">{item.allowInstalments ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {props.items.length === 0 && (
            <p className="py-12 text-center text-muted text-sm">No fee structures yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
