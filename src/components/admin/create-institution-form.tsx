"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const TYPES = [
  ["SCHOOL", "School"],
  ["PRIMARY_SCHOOL", "Primary school"],
  ["HIGH_SCHOOL", "High school"],
  ["COMBINED_SCHOOL", "Combined school"],
  ["COLLEGE", "College"],
  ["TVET", "TVET"],
  ["TRAINING_CENTRE", "Training centre"],
  ["TRAINING_INSTITUTION", "Training institution"],
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function CreateInstitutionForm({ suggestedPrice = "7.00" }: { suggestedPrice?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    institutionType: "SCHOOL",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: "",
    trialExpiresAt: "",
    pricePerLearner: suggestedPrice,
    maxLearners: "1000",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          institutionType: form.institutionType,
          adminFirstName: form.adminFirstName,
          adminLastName: form.adminLastName,
          adminEmail: form.adminEmail,
          adminPhone: form.adminPhone || undefined,
          trialExpiresAt: form.trialExpiresAt || null,
          pricePerLearner: form.pricePerLearner || null,
          maxLearners: form.maxLearners ? Number(form.maxLearners) : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not create institution");
        return;
      }
      toast.success("Institution created with trial licence");
      setOpen(false);
      router.push("/admin/licensing");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Create Institution"}
        </Button>
      </div>
      {open ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create institution</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="name">Institution name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: f.slug && f.slug !== slugify(f.name) ? f.slug : slugify(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="type">Institution type</Label>
                <Select
                  id="type"
                  value={form.institutionType}
                  onChange={(e) => setForm({ ...form, institutionType: e.target.value })}
                >
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="adminFirstName">Primary admin first name</Label>
                <Input
                  id="adminFirstName"
                  required
                  value={form.adminFirstName}
                  onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="adminLastName">Primary admin last name</Label>
                <Input
                  id="adminLastName"
                  required
                  value={form.adminLastName}
                  onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="adminEmail">Primary admin email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="adminPhone">Admin phone (optional)</Label>
                <Input
                  id="adminPhone"
                  value={form.adminPhone}
                  onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="trialExpiresAt">Trial expiry (optional)</Label>
                <Input
                  id="trialExpiresAt"
                  type="date"
                  value={form.trialExpiresAt}
                  onChange={(e) => setForm({ ...form, trialExpiresAt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pricePerLearner">Price after trial (R / ACTIVE learner)</Label>
                <Input
                  id="pricePerLearner"
                  value={form.pricePerLearner}
                  onChange={(e) => setForm({ ...form, pricePerLearner: e.target.value })}
                  placeholder={suggestedPrice}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={loading}>
                  Create with trial
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
