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
import { formatZAR } from "@/lib/utils";
import type { PaymentMethod } from "@prisma/client";

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  outstanding: number;
}

export function PaymentForm({ invoiceId, invoiceNumber, outstanding }: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (outstanding <= 0) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount: form.get("amount"),
          method: form.get("method"),
          reference: form.get("reference") || undefined,
          notes: form.get("notes") || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed");
      }
      toast.success("Payment recorded");
      router.refresh();
      (e.target as HTMLFormElement).reset();
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
            <Label>Reference</Label>
            <Input name="reference" placeholder="EFT ref or receipt no." />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional notes" />
          </div>
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
