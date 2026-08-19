"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CatalogSimpleForm(props: {
  title: string;
  endpoint: string;
  rows: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(props.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      if (!res.ok) throw new Error();
      toast.success("Saved");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>{props.title}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex gap-3 items-end">
            <div className="flex-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <Button type="submit" disabled={loading}>Add</Button>
          </form>
          <ul className="mt-6 divide-y divide-border">
            {props.rows.map((row) => (
              <li key={row.id} className="py-2 text-sm">{row.name}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
