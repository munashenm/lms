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
import { chargeOutstanding } from "@/lib/charge-reversal";
import { InstalmentSchedule } from "@/components/finance/instalment-schedule";

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

interface FeeStructureOpt {
  id: string;
  name: string;
  amount: number;
  chargeSource: string;
}

export function PaymentPlanManager(props: {
  students: StudentOpt[];
  charges: ChargeRow[];
  years: Array<{ id: string; name: string }>;
  feeStructures: FeeStructureOpt[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("manual");
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
      setLoading(null);
    }
  }

  async function applyStructure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("structure");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/student-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.get("studentId"),
          feeStructureId: form.get("feeStructureId"),
          academicYearId: form.get("academicYearId") || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(data.skipped ? "That fee is already on the student ledger" : "Fee structure applied");
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply fee structure");
    } finally {
      setLoading(null);
    }
  }

  async function reverseCharge(id: string) {
    if (!confirm("Reverse the unpaid remainder of this charge? Receipts are kept.")) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/student-charges/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success("Charge reversed on the ledger");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reverse charge");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Apply existing fee structure</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted mb-4">
            Posts the catalogue amount, source and instalment plan. The same student + fee + year is charged only once.
          </p>
          <form onSubmit={applyStructure} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="applyStudentId">Student</Label>
              <select id="applyStudentId" name="studentId" required className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {props.students.map((s) => (
                  <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} ({s.studentNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="feeStructureId">Fee structure</Label>
              <select id="feeStructureId" name="feeStructureId" required className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {props.feeStructures.map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.name} · {formatZAR(fee.amount)} ({fee.chargeSource})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="applyYear">Academic year</Label>
              <select id="applyYear" name="academicYearId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Current / structure default</option>
                {props.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading !== null || props.feeStructures.length === 0}>
                Apply structure
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Manual / hostel / transport charge</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted mb-4">
            Hostel and transport do not auto-apply on enrolment unless those flags are set. Split into a payment plan only when instalment count is greater than 1.
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
            <div className="sm:col-span-2"><Button type="submit" disabled={loading !== null}>Create charge</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payment plans</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {props.charges.length === 0 ? <p className="text-sm text-muted">No charges yet.</p> : null}
          {props.charges.map((charge) => {
            const outstanding = chargeOutstanding(
              Number(charge.amount),
              charge.instalments.map((row) => ({ amountPaid: Number(row.amountPaid) }))
            );
            return (
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
                <div className="mt-2">
                  <InstalmentSchedule
                    instalments={charge.instalments.map((row) => ({
                      ...row,
                      amount: Number(row.amount),
                      amountPaid: Number(row.amountPaid),
                    }))}
                    title="Instalments"
                  />
                </div>
                {outstanding > 0 ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading !== null}
                      onClick={() => reverseCharge(charge.id)}
                    >
                      Reverse unpaid remainder ({formatZAR(outstanding)})
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted mt-2">Fully paid. Reverse receipts from the invoice if needed.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
