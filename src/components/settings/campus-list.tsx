"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Campus {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
  isActive: boolean;
}

export function CampusList({ campuses, canWrite }: { campuses: Campus[]; canWrite: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/campuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not update campus");
        return;
      }
      toast.success(ok);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (campuses.length === 0) return null;

  return (
    <div className="space-y-2">
      {campuses.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <div>
            <p className="font-medium">
              {c.name} ({c.code})
              {c.isMain ? <span className="text-xs text-muted"> · Main</span> : null}
            </p>
            {!c.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
          </div>
          {canWrite ? (
            <div className="flex gap-2">
              {!c.isMain && c.isActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading === c.id}
                  onClick={() => patch(c.id, { isMain: true }, "Marked as main campus")}
                >
                  Set main
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading === c.id}
                onClick={() =>
                  patch(c.id, { isActive: !c.isActive }, c.isActive ? "Campus deactivated" : "Campus reactivated")
                }
              >
                {c.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
