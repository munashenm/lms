"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function CampusCreateForm({ schoolId }: { schoolId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/campuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, schoolId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Could not add campus");
        return;
      }
      toast.success("Campus added");
      setForm({ name: "", code: "" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add campus</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="campusName">Name</Label>
            <Input
              id="campusName"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="campusCode">Code</Label>
            <Input
              id="campusCode"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading} className="w-full">
              Add campus
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
