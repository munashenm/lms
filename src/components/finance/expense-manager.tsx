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

interface Row {
  id: string;
  description: string;
  amount: number;
  vatAmount: number;
  approvalStatus: string;
  transactionDate: string | Date;
  attachmentUrl?: string | null;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
}

export function ExpenseManager(props: {
  expenses: Row[];
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error();
      toast.success("Expense captured");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save expense");
    } finally {
      setLoading(false);
    }
  }

  async function postExpense(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Expense posted to the ledger");
      router.refresh();
    } catch {
      toast.error("Could not post expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Capture expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div>
              <Label htmlFor="vatAmount">VAT</Label>
              <Input id="vatAmount" name="vatAmount" type="number" step="0.01" defaultValue="0" />
            </div>
            <div>
              <Label htmlFor="transactionDate">Transaction date</Label>
              <Input id="transactionDate" name="transactionDate" type="date" required />
            </div>
            <div>
              <Label htmlFor="invoiceRef">Invoice / reference</Label>
              <Input id="invoiceRef" name="invoiceRef" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="file">Slip / invoice (PDF or image)</Label>
              <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            </div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <select id="categoryId" name="categoryId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="supplierId">Supplier</Label>
              <select id="supplierId" name="supplierId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {props.suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="financialAccountId">Payment account</Label>
              <select id="financialAccountId" name="financialAccountId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {props.accounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="post" name="post" type="checkbox" defaultChecked />
              <Label htmlFor="post">Post to ledger now</Label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>Save expense</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Category</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.expenses.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatDate(row.transactionDate)}</td>
                  <td className="px-4 py-3">{row.description}</td>
                  <td className="px-4 py-3 text-muted">{row.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(row.amount)}</td>
                  <td className="px-4 py-3"><Badge>{row.approvalStatus}</Badge></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {row.attachmentUrl ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={row.attachmentUrl} target="_blank" rel="noreferrer">Slip</a>
                      </Button>
                    ) : null}
                    {row.approvalStatus !== "POSTED" ? (
                      <Button size="sm" variant="outline" disabled={loading} onClick={() => postExpense(row.id)}>Post</Button>
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
