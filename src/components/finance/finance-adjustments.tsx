"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZAR, formatDate } from "@/lib/utils";

interface StudentOpt {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

export function FinanceAdjustments(props: {
  students: StudentOpt[];
  creditNotes: Array<{ id: string; number: string; amount: unknown; reason: string; createdAt: Date | string; student: StudentOpt }>;
  refunds: Array<{ id: string; amount: unknown; reason: string; status: string; createdAt: Date | string; student: StudentOpt }>;
  awards: Array<{ id: string; name: string; type: string; amount: unknown; createdAt: Date | string; student: StudentOpt }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function post(path: string, body: unknown, key: string, ok: string) {
    setLoading(key);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(ok);
      router.refresh();
    } catch {
      toast.error("Could not save");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Credit note</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                post("/api/credit-notes", {
                  studentId: form.get("studentId"),
                  amount: Number(form.get("amount")),
                  reason: form.get("reason"),
                }, "cn", "Credit note posted to the student ledger");
                e.currentTarget.reset();
              }}
            >
              <StudentSelect students={props.students} />
              <div><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div><Label>Reason</Label><Input name="reason" required /></div>
              <Button type="submit" disabled={loading === "cn"}>Post credit</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Refund</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                post("/api/refunds", {
                  studentId: form.get("studentId"),
                  amount: Number(form.get("amount")),
                  reason: form.get("reason"),
                }, "rf", "Refund posted to the student ledger");
                e.currentTarget.reset();
              }}
            >
              <StudentSelect students={props.students} />
              <div><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div><Label>Reason</Label><Input name="reason" required /></div>
              <Button type="submit" disabled={loading === "rf"}>Post refund</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bursary / aid</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                post("/api/student-aid", {
                  studentId: form.get("studentId"),
                  type: form.get("type"),
                  name: form.get("name"),
                  amount: Number(form.get("amount")),
                }, "aid", "Aid posted to the student ledger");
                e.currentTarget.reset();
              }}
            >
              <StudentSelect students={props.students} />
              <div>
                <Label>Type</Label>
                <select name="type" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="BURSARY">Bursary</option>
                  <option value="DISCOUNT">Discount</option>
                  <option value="SCHOLARSHIP">Scholarship</option>
                  <option value="SPONSORSHIP">Sponsorship</option>
                </select>
              </div>
              <div><Label>Name</Label><Input name="name" required /></div>
              <div><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
              <Button type="submit" disabled={loading === "aid"}>Award</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent ledger adjustments</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {props.creditNotes.map((row) => (
            <p key={row.id}>Credit {row.number} · {row.student.firstName} {row.student.lastName} · {formatZAR(Number(row.amount))} · {formatDate(row.createdAt)}</p>
          ))}
          {props.refunds.map((row) => (
            <p key={row.id}>Refund · {row.student.firstName} {row.student.lastName} · {formatZAR(Number(row.amount))} · {row.status}</p>
          ))}
          {props.awards.map((row) => (
            <p key={row.id}>{row.type} {row.name} · {row.student.firstName} {row.student.lastName} · {formatZAR(Number(row.amount))}</p>
          ))}
          {props.creditNotes.length + props.refunds.length + props.awards.length === 0 ? (
            <p className="text-muted">No credit notes, refunds or aid yet. These append ledger rows; they never edit a stored student balance.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentSelect({ students }: { students: StudentOpt[] }) {
  return (
    <div>
      <Label>Student</Label>
      <select name="studentId" required className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} ({s.studentNumber})</option>
        ))}
      </select>
    </div>
  );
}
