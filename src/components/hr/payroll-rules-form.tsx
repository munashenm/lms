"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const FIELDS = [
  ["employeeTaxPercent", "Income tax %"],
  ["uifEmployeePercent", "UIF employee %"],
  ["uifEmployerPercent", "UIF employer %"],
  ["pensionEmployeePercent", "Pension employee %"],
  ["pensionEmployerPercent", "Pension employer %"],
  ["medicalEmployeePercent", "Medical aid %"],
  ["sdlEmployerPercent", "SDL employer %"],
] as const;

export function PayrollRulesForm(props: {
  current?: {
    name: string;
    jurisdiction: string;
    effectiveFrom: Date | string;
    rules: Record<string, unknown>;
  } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const rules = props.current?.rules ?? {};

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const body: Record<string, unknown> = {
        name: form.get("name"),
        jurisdiction: form.get("jurisdiction") || "ZA",
        effectiveFrom: form.get("effectiveFrom"),
      };
      for (const [key] of FIELDS) body[key] = Number(form.get(key) || 0);
      const res = await fetch("/api/payroll/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Payroll rules version saved");
      router.refresh();
    } catch {
      toast.error("Could not save payroll rules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Statutory rates (versioned)</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted mb-4">
          Rates come only from this configuration. Tax tables are not hard-coded. Leave percents at 0 until your accountant supplies figures.
        </p>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required defaultValue={props.current?.name ?? "ZA rates"} /></div>
          <div><Label htmlFor="jurisdiction">Jurisdiction</Label><Input id="jurisdiction" name="jurisdiction" defaultValue={props.current?.jurisdiction ?? "ZA"} /></div>
          <div>
            <Label htmlFor="effectiveFrom">Effective from</Label>
            <Input id="effectiveFrom" name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          {FIELDS.map(([name, label]) => (
            <div key={name}>
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} type="number" step="0.01" min="0" max="100" defaultValue={Number(rules[name] ?? 0)} />
            </div>
          ))}
          <div className="sm:col-span-2"><Button type="submit" disabled={loading}>Save new version</Button></div>
        </form>
        {props.current ? (
          <p className="text-xs text-muted mt-3">
            Current set effective {formatDate(props.current.effectiveFrom)}. Saving creates a new version and closes the previous one.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
