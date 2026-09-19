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
import { CollectionPrintActions } from "@/components/finance/collection-print-actions";
import type { PaymentMethod } from "@prisma/client";

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  outstanding: number;
  studentId?: string;
  showPrintActions?: boolean;
  instalments?: Array<{
    id: string;
    sequence: number;
    dueDate: Date | string;
    amount: number;
    amountPaid: number;
    status: string;
  }>;
  onRecorded?: (payment: { id: string }) => void;
}

export function PaymentForm({
  invoiceId,
  invoiceNumber,
  outstanding,
  studentId,
  showPrintActions = true,
  instalments = [],
  onRecorded,
}: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const openInstalments = instalments.filter(
    (row) => outstandingOf(row.amount, row.amountPaid) > 0
  );

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
      const formData = new FormData();
      formData.set("invoiceId", invoiceId);
      formData.set("amount", String(amount));
      formData.set("method", String(form.get("method") ?? ""));
      if (form.get("reference")) formData.set("reference", String(form.get("reference")));
      if (form.get("bankReference")) formData.set("bankReference", String(form.get("bankReference")));
      if (form.get("notes")) formData.set("notes", String(form.get("notes")));
      if (form.get("feeType")) formData.set("feeType", String(form.get("feeType")));
      if (form.get("paidAt")) formData.set("paidAt", String(form.get("paidAt")));
      if (picked.allocations.length) formData.set("allocations", JSON.stringify(picked.allocations));
      const proof = form.get("proof");
      if (proof instanceof File && proof.size > 0) formData.set("proof", proof);

      const res = await fetch("/api/payments", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed");
      }
      const data = (await res.json()) as { payment?: { id?: string } };
      const paymentId = data.payment?.id ?? null;
      setLastPaymentId(paymentId);
      toast.success("Payment captured. You can print the invoice and statement.");
      router.refresh();
      if (paymentId) onRecorded?.({ id: paymentId });
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

  if (outstanding <= 0 && (!showPrintActions || !lastPaymentId)) return null;

  return (
    <div className="space-y-4">
      {showPrintActions && lastPaymentId ? (
        <CollectionPrintActions
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          paymentId={lastPaymentId}
          studentId={studentId}
          heading="Payment captured"
        />
      ) : null}
      {outstanding <= 0 ? null : (
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
              step="0.01"
              defaultValue={outstanding.toFixed(2)}
              required
            />
            <p className="text-xs text-muted">Amount above outstanding creates a student credit.</p>
          </div>
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select name="method" defaultValue="EFT" required>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
                .filter((method) => method !== "PAYPAL")
                .map((method) => (
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
            <Label>Bank / payment reference</Label>
            <Input name="bankReference" placeholder="Bank statement reference" />
          </div>
          <div className="space-y-2">
            <Label>Fee type</Label>
            <Input name="feeType" placeholder="Tuition, transport, exam…" />
          </div>
          <div className="space-y-2">
            <Label>Internal reference</Label>
            <Input name="reference" placeholder="Optional extra reference" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional notes" />
          </div>
          <div className="space-y-2">
            <Label>Proof of payment</Label>
            <Input name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
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
            <p className="text-xs text-muted mt-2">
              EFT and bank deposits stay pending until finance verifies and approves them. Cash and card post immediately.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
      )}
    </div>
  );
}
