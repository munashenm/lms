"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance";
import { formatDate, formatZAR, johannesburgDatetimeLocalValue } from "@/lib/utils";
import { outstandingOf } from "@/lib/money";
import { selectedAllocations } from "@/lib/charge-reversal";
import type { PaymentMethod } from "@prisma/client";

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  outstanding: number;
  instalments?: Array<{
    id: string;
    sequence: number;
    dueDate: Date | string;
    amount: number;
    amountPaid: number;
    status: string;
  }>;
  onRecorded?: () => void;
}

export function PaymentForm({
  invoiceId,
  invoiceNumber,
  outstanding,
  instalments = [],
  onRecorded,
}: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const openInstalments = instalments.filter(
    (row) => outstandingOf(row.amount, row.amountPaid) > 0
  );

  if (outstanding <= 0) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const allocationRows = openInstalments.map((row) => ({
      instalmentId: row.id,
      amount: Number(form.get(`alloc-${row.id}`) || 0),
    }));
    const picked = selectedAllocations(allocationRows, amount);

    try {
      if (!picked.ok) throw new Error(picked.message);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount,
          method: form.get("method"),
          reference: form.get("reference") || undefined,
          notes: form.get("notes") || undefined,
          paidAt: form.get("paidAt") || undefined,
          allocations: picked.allocations.length ? picked.allocations : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed");
      }
      toast.success("Payment recorded");
      router.refresh();
      onRecorded?.();
      const formEl = e.target as HTMLFormElement;
      formEl.reset();
      const paidAtInput = formEl.elements.namedItem("paidAt");
      if (paidAtInput instanceof HTMLInputElement) {
        paidAtInput.value = johannesburgDatetimeLocalValue();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record Payment</CardTitle>
        <p className="text-sm text-muted">
          {invoiceNumber} · Outstanding: {formatZAR(outstanding)}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amount (ZAR) *</Label>
            <Input
              name="amount"
              type="number"
              min={0.01}
              max={outstanding}
              step="0.01"
              defaultValue={outstanding.toFixed(2)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select name="method" defaultValue="EFT" required>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Collection date and time *</Label>
            <Input
              name="paidAt"
              type="datetime-local"
              defaultValue={johannesburgDatetimeLocalValue()}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input name="reference" placeholder="EFT ref or receipt no." />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional notes" />
          </div>
          {openInstalments.length > 0 ? (
            <div className="sm:col-span-2 space-y-2">
              <Label>Allocate to instalments (optional)</Label>
              <p className="text-xs text-muted">
                Leave amounts blank to apply oldest outstanding first. Enter amounts only when you
                need a specific instalment split.
              </p>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted border-b border-border">
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Due</th>
                      <th className="text-right px-3 py-2">Outstanding</th>
                      <th className="text-right px-3 py-2">This payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInstalments.map((row) => {
                      const due = outstandingOf(row.amount, row.amountPaid);
                      return (
                        <tr key={row.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">{row.sequence}</td>
                          <td className="px-3 py-2">{formatDate(row.dueDate)}</td>
                          <td className="px-3 py-2 text-right">{formatZAR(due)}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              name={`alloc-${row.id}`}
                              type="number"
                              min={0}
                              max={due}
                              step="0.01"
                              className="h-8 w-28 ml-auto"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
