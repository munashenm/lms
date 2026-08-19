"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate } from "@/lib/utils";

interface StudentOpt {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

interface ChargeRow {
  id: string;
  description: string;
  source: string;
  amount: unknown;
  student: StudentOpt;
  invoice?: { id: string; invoiceNumber: string } | null;
  instalments: Array<{
    id: string;
    sequence: number;
    dueDate: Date | string;
    amount: unknown;
    amountPaid: unknown;
    status: string;
  }>;
}

export function PaymentPlanManager(props: {
  students: StudentOpt[];
  charges: ChargeRow[];
  years: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const count = Number(form.get("instalmentCount") || 1);
    try {
      const res = await fetch("/api/student-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.get("studentId"),
          description: form.get("description"),
          amount: Number(form.get("amount")),
          source: form.get("source"),
          academicYearId: form.get("academicYearId") || null,
          dueDate: form.get("dueDate") || null,
          allowInstalments: count > 1,
          instalmentCount: count > 1 ? count : 1,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Charge posted to the student ledger");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not create charge");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Manual / hostel / transport charge</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted mb-4">
            Hostel and transport do not auto-apply on enrolment. Split into a payment plan only when instalment count is greater than 1.
          </p>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="studentId">Student</Label>
              <select id="studentId" name="studentId" required className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {props.students.map((s) => (
                  <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} ({s.studentNumber})</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required placeholder="Hostel term 1" />
            </div>
            <div><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" required /></div>
            <div>
              <Label htmlFor="source">Source</Label>
              <select id="source" name="source" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="MANUAL_CHARGE">Manual</option>
                <option value="HOSTEL_FEE">Hostel</option>
                <option value="TRANSPORT_FEE">Transport</option>
              </select>
            </div>
            <div><Label htmlFor="dueDate">First due date</Label><Input id="dueDate" name="dueDate" type="date" /></div>
            <div>
              <Label htmlFor="instalmentCount">Instalments</Label>
              <Input id="instalmentCount" name="instalmentCount" type="number" min="1" defaultValue="1" />
            </div>
            <div>
              <Label htmlFor="academicYearId">Academic year</Label>
              <select id="academicYearId" name="academicYearId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Current / none</option>
                {props.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading}>Create charge</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payment plans</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {props.charges.length === 0 ? <p className="text-sm text-muted">No charges yet.</p> : null}
          {props.charges.map((charge) => (
            <div key={charge.id} className="border border-border rounded-md p-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <p className="font-medium">
                  {charge.student.firstName} {charge.student.lastName} · {charge.description}
                </p>
                <p>{formatZAR(Number(charge.amount))} <Badge variant="secondary">{charge.source}</Badge></p>
              </div>
              {charge.invoice ? (
                <p className="text-xs text-muted mt-1">Invoice {charge.invoice.invoiceNumber}</p>
              ) : null}
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">Due</th>
                    <th className="text-right py-1">Amount</th>
                    <th className="text-right py-1">Paid</th>
                    <th className="text-left py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {charge.instalments.map((row) => (
                    <tr key={row.id}>
                      <td className="py-1">{row.sequence}</td>
                      <td className="py-1">{formatDate(row.dueDate)}</td>
                      <td className="py-1 text-right">{formatZAR(Number(row.amount))}</td>
                      <td className="py-1 text-right">{formatZAR(Number(row.amountPaid))}</td>
                      <td className="py-1">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
