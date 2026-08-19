"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function StructureRecordRow({
  endpoint,
  name,
  extra,
  isActive,
  canWrite,
}: {
  endpoint: string;
  name: string;
  extra?: string;
  isActive: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, unknown>, ok: string) {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not update");
        return;
      }
      toast.success(ok);
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0 text-sm">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ name: value }, "Updated");
            }}
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} required />
            <Button type="submit" size="sm" disabled={loading}>Save</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <p className="font-medium truncate">{name}</p>
            {extra ? <p className="text-xs text-muted">{extra}</p> : null}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isActive ? <Badge variant="secondary">Inactive</Badge> : null}
        {canWrite && !editing ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => patch({ isActive: !isActive }, isActive ? "Deactivated" : "Reactivated")}
            >
              {isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
