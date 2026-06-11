"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { formatZAR } from "@/lib/utils";

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceFormProps {
  students: StudentOption[];
  apiBase?: string;
  redirectTo?: string;
}

export function InvoiceForm({
  students,
  apiBase = "/api/invoices",
  redirectTo = "/admin/finance/invoices",
}: InvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "Tuition Fee", quantity: 1, unitPrice: 5000 },
  ]);
  const [discount, setDiscount] = useState(0);

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.get("studentId"),
          description: form.get("description") || undefined,
          discount,
          dueDate: form.get("dueDate") || undefined,
          status: form.get("status") || "SENT",
          lineItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed");
      }
      toast.success("Invoice created");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select name="studentId" required defaultValue="">
                <option value="" disabled>Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.studentNumber})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input name="dueDate" type="date" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input name="description" placeholder="Term 1 fees — 2026" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="SENT">
                <option value="SENT">Send immediately</option>
                <option value="DRAFT">Save as draft</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount / Scholarship (ZAR)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0 }])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    required
                    placeholder="Tuition fee"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateLine(index, "quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-6 sm:col-span-3 space-y-1">
                  <Label className="text-xs">Unit Price (ZAR)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-border">
            <div className="text-sm space-y-1">
              <p>Subtotal: <span className="font-medium">{formatZAR(subtotal)}</span></p>
              {discount > 0 && (
                <p>Discount: <span className="font-medium text-success">−{formatZAR(discount)}</span></p>
              )}
              <p className="text-base font-bold">Total: {formatZAR(total)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
