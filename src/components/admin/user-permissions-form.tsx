"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSION_LABELS, type ActionPermission } from "@/lib/permissions";

type Group = {
  id: string;
  label: string;
  items: Array<{ key: ActionPermission; label: string }>;
};

export function UserPermissionsForm({
  userId,
  userName,
  roleLabel,
  groups,
  roleDefaults,
  initialGrants,
  initialDenies,
}: {
  userId: string;
  userName: string;
  roleLabel: string;
  groups: Group[];
  roleDefaults: ActionPermission[];
  initialGrants: ActionPermission[];
  initialDenies: ActionPermission[];
}) {
  const router = useRouter();
  const [grants, setGrants] = useState<Set<string>>(new Set(initialGrants));
  const [denies, setDenies] = useState<Set<string>>(new Set(initialDenies));
  const [saving, setSaving] = useState(false);
  const defaults = useMemo(() => new Set(roleDefaults), [roleDefaults]);

  function enabled(key: ActionPermission) {
    if (denies.has(key)) return false;
    if (grants.has(key)) return true;
    return defaults.has(key);
  }

  function toggle(key: ActionPermission, on: boolean) {
    const nextGrants = new Set(grants);
    const nextDenies = new Set(denies);
    if (on) {
      nextDenies.delete(key);
      if (defaults.has(key)) nextGrants.delete(key);
      else nextGrants.add(key);
    } else {
      nextGrants.delete(key);
      if (defaults.has(key)) nextDenies.add(key);
      else nextDenies.delete(key);
    }
    setGrants(nextGrants);
    setDenies(nextDenies);
  }

  function selectAll() {
    const nextGrants = new Set<string>();
    const nextDenies = new Set<string>();
    for (const group of groups) {
      for (const item of group.items) {
        if (!defaults.has(item.key)) nextGrants.add(item.key);
      }
    }
    setGrants(nextGrants);
    setDenies(nextDenies);
  }

  function clearAll() {
    const nextDenies = new Set<string>();
    for (const group of groups) {
      for (const item of group.items) {
        if (defaults.has(item.key)) nextDenies.add(item.key);
      }
    }
    setGrants(new Set());
    setDenies(nextDenies);
  }

  function resetDefaults() {
    setGrants(new Set());
    setDenies(new Set());
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants: [...grants], denies: [...denies] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not save permissions");
        return;
      }
      toast.success("Permissions saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{userName}</h1>
        <p className="text-muted text-sm mt-1">Role: {roleLabel}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={selectAll}>Select All</Button>
        <Button type="button" variant="outline" onClick={clearAll}>Clear All</Button>
        <Button type="button" variant="outline" onClick={resetDefaults}>Reset to Role Defaults</Button>
        <Button type="button" onClick={save} disabled={saving}>Save Permissions</Button>
      </div>
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle className="text-base">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {group.items.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled(item.key)}
                  onChange={(e) => toggle(item.key, e.target.checked)}
                />
                <span>{item.label || PERMISSION_LABELS[item.key]}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
