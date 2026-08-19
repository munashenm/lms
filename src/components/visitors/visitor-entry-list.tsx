"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  VISITOR_HOST_KIND_LABELS,
  VISITOR_PURPOSE_LABELS,
  formatVisitorDateTime,
  visitorIsOnSite,
  type PublicVisitorEntry,
} from "@/lib/visitors";

export function VisitorEntryList({ entries }: { entries: PublicVisitorEntry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function signOut(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/visitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign_out" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not sign out");
      toast.success("Visitor signed out");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out");
    } finally {
      setBusyId(null);
    }
  }

  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">No visitor records for this view.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {entries.map((row) => {
        const onSite = visitorIsOnSite(row.signedOutAt);
        return (
          <div key={row.id} className="px-4 py-3 text-sm space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {row.firstName} {row.lastName}
                  {row.organisation ? ` · ${row.organisation}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Visiting {VISITOR_HOST_KIND_LABELS[row.hostKind] ?? row.hostKind.toLowerCase()}:{" "}
                  {row.hostName}
                  {row.campusName ? ` · ${row.campusName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={onSite ? "warning" : "success"}>
                  {onSite ? "On site" : "Signed out"}
                </Badge>
                {onSite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => signOut(row.id)}
                  >
                    {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Sign out
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-muted">
              {VISITOR_PURPOSE_LABELS[row.purpose] ?? row.purpose}
              {row.purposeDetail ? ` · ${row.purposeDetail}` : ""}
            </p>
            <p className="text-xs text-muted">
              In {formatVisitorDateTime(row.signedInAt)}
              {row.signedInByName ? ` · ${row.signedInByName}` : ""}
              {row.signedOutAt
                ? ` · Out ${formatVisitorDateTime(row.signedOutAt)}${row.signedOutByName ? ` · ${row.signedOutByName}` : ""}`
                : ""}
              {row.identityNumber ? ` · ID ${row.identityNumber}` : ""}
              {row.vehicleRegistration ? ` · ${row.vehicleRegistration}` : ""}
              {row.badgeNumber ? ` · Badge ${row.badgeNumber}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
