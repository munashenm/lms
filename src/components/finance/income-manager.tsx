"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZAR, formatDate } from "@/lib/utils";

export function IncomeManager(props: {
  items: Array<{
    id: string;
    description: string;
    amount: number;
    receivedAt: Date | string;
    category?: { name: string } | null;
    attachmentUrl?: string | null;
  }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    try {
      const res = await fetch("/api/other-income", {
        method: "POST",
        body: new FormData(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Income recorded");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Could not save income");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Non-student income</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="description">Description</Label><Input id="description" name="description" required /></div>
            <div><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" required /></div>
            <div><Label htmlFor="receivedAt">Date</Label><Input id="receivedAt" name="receivedAt" type="date" required /></div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <select id="categoryId" name="categoryId" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label htmlFor="reference">Reference</Label><Input id="reference" name="reference" /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="file">Slip / receipt (PDF or image)</Label>
              <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading}>Save</Button></div>
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
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatDate(row.receivedAt)}</td>
                  <td className="px-4 py-3">{row.description}<span className="text-muted text-xs block">{row.category?.name}</span></td>
                  <td className="px-4 py-3 text-right">{formatZAR(row.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.attachmentUrl ? (
                      <a href={row.attachmentUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                        Slip
                      </a>
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
