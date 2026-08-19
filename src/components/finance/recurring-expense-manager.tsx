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

export function RecurringExpenseManager(props: {
  items: Array<{
    id: string;
    description: string;
    amount: unknown;
    interval: string;
    nextDueDate: Date | string;
    requireConfirm: boolean;
    isActive: boolean;
    supplier?: { name: string } | null;
    category?: { name: string } | null;
  }>;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.get("description"),
          amount: Number(form.get("amount")),
          interval: form.get("interval"),
          nextDueDate: form.get("nextDueDate"),
          categoryId: form.get("categoryId") || null,
          supplierId: form.get("supplierId") || null,
          financialAccountId: form.get("financialAccountId") || null,
          requireConfirm: form.get("requireConfirm") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Recurring expense saved");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save");
    } finally {
      setLoading(null);
    }
  }

  async function generate(id?: string) {
    setLoading(id ?? "due");
    try {
      const res = await fetch("/api/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { generateId: id } : { generateDue: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(id ? "Draft expense generated" : "Due recurring expenses generated");
      router.refresh();
    } catch {
      toast.error("Could not generate");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Recurring expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="description">Description</Label><Input id="description" name="description" required /></div>
            <div><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" required /></div>
            <div>
              <Label htmlFor="interval">Interval</Label>
              <select id="interval" name="interval" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half-yearly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div><Label htmlFor="nextDueDate">Next due</Label><Input id="nextDueDate" name="nextDueDate" type="date" required /></div>
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
              <Label htmlFor="financialAccountId">Account</Label>
              <select id="financialAccountId" name="financialAccountId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {props.accounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="requireConfirm" defaultChecked /> Require confirmation (create as draft)
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={Boolean(loading)}>Save schedule</Button>
              <Button type="button" variant="outline" disabled={Boolean(loading)} onClick={() => generate()}>Generate due now</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Next due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {row.description}
                    <span className="block text-xs text-muted">{row.interval} · {row.category?.name ?? "Uncategorised"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(row.amount))}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{formatDate(row.nextDueDate)}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => generate(row.id)}>Generate</Button>
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
