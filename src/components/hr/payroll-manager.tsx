"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate } from "@/lib/utils";
import Link from "next/link";

export function PayrollManager(props: {
  runs: Array<{
    id: string;
    status: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    totalGross: unknown;
    totalNet: unknown;
    totalEmployer: unknown;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const runBasePath = pathname.startsWith("/admin") ? "/admin/payroll" : "/hr/payroll";
  const [loading, setLoading] = useState<string | null>(null);

  async function createRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: form.get("periodStart"),
          periodEnd: form.get("periodEnd"),
          paymentDate: form.get("paymentDate") || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Draft payroll calculated");
      router.refresh();
    } catch {
      toast.error("Could not create payroll run");
    } finally {
      setLoading(null);
    }
  }

  async function act(id: string, action: "calculate" | "approve" | "finalise" | "reverse") {
    setLoading(id + action);
    try {
      const res = await fetch(`/api/payroll/runs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed");
      }
      toast.success(`Payroll ${action === "reverse" ? "reversed" : `${action}d`}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>New payroll run</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createRun} className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="periodStart">Period start</Label><Input id="periodStart" name="periodStart" type="date" required /></div>
            <div><Label htmlFor="periodEnd">Period end</Label><Input id="periodEnd" name="periodEnd" type="date" required /></div>
            <div><Label htmlFor="paymentDate">Payment date</Label><Input id="paymentDate" name="paymentDate" type="date" /></div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={loading === "create"}>Calculate draft</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Period</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Gross</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Employer</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Net</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.runs.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</td>
                  <td className="px-4 py-3"><Badge>{run.status}</Badge></td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(run.totalGross))}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(run.totalEmployer))}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(run.totalNet))}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`${runBasePath}/${run.id}`}>Review</Link>
                    </Button>
                    {run.status === "DRAFT" || run.status === "CALCULATED" ? (
                      <Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => act(run.id, "approve")}>Approve</Button>
                    ) : null}
                    {run.status === "APPROVED" ? (
                      <Button size="sm" disabled={Boolean(loading)} onClick={() => act(run.id, "finalise")}>Finalise & post</Button>
                    ) : null}
                    {run.status === "FINALISED" ? (
                      <Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => {
                        if (confirm("Reverse this payroll? Payslips are kept and offsetting ledger rows are posted.")) {
                          act(run.id, "reverse");
                        }
                      }}>Reverse</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
