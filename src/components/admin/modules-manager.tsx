"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type ModuleRow = { moduleKey: string; label: string; enabled: boolean };

export function ModulesManager({
  schools,
  initialSchoolId,
  initialModules,
}: {
  schools: Array<{ id: string; name: string }>;
  initialSchoolId: string;
  initialModules: ModuleRow[];
}) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [modules, setModules] = useState(initialModules);
  const [loading, setLoading] = useState(false);

  async function loadSchool(id: string) {
    setSchoolId(id);
    const res = await fetch(`/api/modules?schoolId=${id}`);
    const json = await res.json();
    if (res.ok) setModules(json.modules);
  }

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          modules: modules.map((row) => ({ moduleKey: row.moduleKey, enabled: row.enabled })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not save modules");
        return;
      }
      toast.success("Modules updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Institution modules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schools.length > 1 ? (
          <Select value={schoolId} onChange={(e) => loadSchool(e.target.value)}>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </Select>
        ) : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2">Module</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((row) => (
              <tr key={row.moduleKey} className="border-b border-border last:border-0">
                <td className="py-2">{row.label}</td>
                <td className="py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        setModules((current) =>
                          current.map((item) =>
                            item.moduleKey === row.moduleKey
                              ? { ...item, enabled: e.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    {row.enabled ? "Enabled" : "Disabled"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="button" onClick={save} disabled={loading}>Save modules</Button>
      </CardContent>
    </Card>
  );
}
