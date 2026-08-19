"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TYPES = ["ANNUAL", "SICK", "FAMILY", "MATERNITY", "STUDY", "UNPAID", "OTHER"];

export function LeavePolicyManager(props: {
  policies: Array<{ id: string; name: string; leaveType: string; daysPerYear: unknown; accrualMethod: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          leaveType: form.get("leaveType"),
          daysPerYear: Number(form.get("daysPerYear")),
          accrualMethod: form.get("accrualMethod"),
          requiresHrApproval: form.get("requiresHrApproval") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Leave policy saved");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save policy");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Configurable leave policy</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted mb-4">Statutory days are not hard-coded. Set entitlements for your jurisdiction.</p>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Annual leave" /></div>
            <div>
              <Label htmlFor="leaveType">Type</Label>
              <select id="leaveType" name="leaveType" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label htmlFor="daysPerYear">Days per year</Label><Input id="daysPerYear" name="daysPerYear" type="number" step="0.5" min="0" required /></div>
            <div>
              <Label htmlFor="accrualMethod">Accrual</Label>
              <select id="accrualMethod" name="accrualMethod" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="NONE">None (grant full balance)</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="requiresHrApproval" name="requiresHrApproval" type="checkbox" />
              <Label htmlFor="requiresHrApproval">Requires HR approval</Label>
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading}>Save policy</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Type</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Days / year</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Accrual</th>
              </tr>
            </thead>
            <tbody>
              {props.policies.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.leaveType}</td>
                  <td className="px-4 py-3 text-right">{Number(p.daysPerYear)}</td>
                  <td className="px-4 py-3">{p.accrualMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
