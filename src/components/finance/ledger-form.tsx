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

const INCOME_CATEGORIES = ["Donations", "Grants", "Other Income", "Sponsorship"];
const EXPENSE_CATEGORIES = ["Salaries", "Utilities", "Supplies", "Maintenance", "Marketing", "Other Expense"];

export function LedgerForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entryType, setEntryType] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Entry recorded");
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Failed to record entry");
    } finally {
      setLoading(false);
    }
  }

  const categories = entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Record Entry</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select name="type" required value={entryType} onChange={(e) => setEntryType(e.target.value as "INCOME" | "EXPENSE")}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select name="category" required>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description *</Label>
            <Input name="description" required placeholder="e.g. Monthly electricity bill" />
          </div>
          <div className="space-y-2">
            <Label>Amount (ZAR) *</Label>
            <Input name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input name="entryDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input name="reference" placeholder="Invoice / EFT ref" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
