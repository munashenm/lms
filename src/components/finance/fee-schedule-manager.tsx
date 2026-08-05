"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { formatZAR } from "@/lib/utils";

export interface FeeScheduleItemRow {
  id: string;
  name: string;
  amount: number;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
}

interface FeeScheduleManagerProps {
  schoolId: string;
  items: FeeScheduleItemRow[];
}

export function FeeScheduleManager({ schoolId, items }: FeeScheduleManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function createItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/fee-schedule?schoolId=${encodeURIComponent(schoolId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: form.get("name"),
          amount: parseFloat(form.get("amount") as string),
          notes: form.get("notes") || undefined,
          sortOrder: parseInt(form.get("sortOrder") as string, 10) || 0,
          isPublic: form.get("isPublic") === "on",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Fee item added");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Failed to add fee item");
    } finally {
      setLoading(null);
    }
  }

  async function toggleField(id: string, field: "isActive" | "isPublic", value: boolean) {
    setLoading(id);
    try {
      const res = await fetch(`/api/fee-schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Remove this fee schedule item?")) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/fee-schedule/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Fee item removed");
      router.refresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Fee Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="fs-name">Item name</Label>
              <Input id="fs-name" name="name" placeholder="Tuition — per term" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fs-amount">Amount (ZAR)</Label>
              <Input id="fs-amount" name="amount" type="number" min={0.01} step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fs-order">Sort order</Label>
              <Input id="fs-order" name="sortOrder" type="number" min={0} defaultValue={items.length + 1} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="fs-notes">Notes</Label>
              <Input id="fs-notes" name="notes" placeholder="Payable per term" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 rounded border-border" />
              Show on public fees page
            </label>
            <Button type="submit" disabled={loading === "create"}>
              {loading === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add item"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee Schedule ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted text-sm">No fee items yet. Add items above.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatZAR(item.amount)}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.isActive && <Badge variant="secondary">Inactive</Badge>}
                    {item.isPublic ? (
                      <Badge variant="accent">Public</Badge>
                    ) : (
                      <Badge variant="secondary">Internal only</Badge>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading === item.id}
                      onClick={() => toggleField(item.id, "isPublic", !item.isPublic)}
                    >
                      {item.isPublic ? "Hide public" : "Show public"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading === item.id}
                      onClick={() => toggleField(item.id, "isActive", !item.isActive)}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
