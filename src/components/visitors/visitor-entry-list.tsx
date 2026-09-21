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
  VISITOR_STATUS_LABELS,
  formatVisitorDateTime,
  visitorBadgeDocument,
  visitorIsOnSite,
  type PublicVisitorEntry,
} from "@/lib/visitors";

function printBadge(row: PublicVisitorEntry, schoolName: string) {
  const win = window.open("", "visitor-badge", "width=420,height=520");
  if (!win) {
    toast.error("Allow pop-ups to print the visitor badge");
    return;
  }
  win.document.write(
    visitorBadgeDocument({
      schoolName,
      visitorName: `${row.firstName} ${row.lastName}`,
      hostName: row.hostName,
      purpose: VISITOR_PURPOSE_LABELS[row.purpose] ?? row.purpose,
      badgeNumber: row.badgeNumber,
      signedInAt: formatVisitorDateTime(row.signedInAt),
    })
  );
  win.document.close();
}

export function VisitorEntryList({
  entries,
  schoolName = "SchoolHub SA",
}: {
  entries: PublicVisitorEntry[];
  schoolName?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, action: "sign_out" | "check_in" | "deny") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/visitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not update visitor");
      toast.success(action === "sign_out" ? "Visitor signed out" : action === "deny" ? "Visitor denied" : "Visitor checked in");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update visitor");
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
        const status = row.status ?? (visitorIsOnSite(row.signedOutAt) ? "CHECKED_IN" : "CHECKED_OUT");
        const onSite = visitorIsOnSite(row.signedOutAt, status);
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
                  {row.department ? ` · ${row.department}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={status === "OVERDUE" ? "danger" : onSite ? "warning" : status === "EXPECTED" ? "secondary" : "success"}>
                  {VISITOR_STATUS_LABELS[status] ?? status}
                </Badge>
                {status === "EXPECTED" ? (
                  <>
                    <Button size="sm" disabled={busyId === row.id} onClick={() => run(row.id, "check_in")}>
                      {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Check in
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => run(row.id, "deny")}>
                      Deny
                    </Button>
                  </>
                ) : null}
                {onSite ? (
                  <Button
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => run(row.id, "sign_out")}
                  >
                    {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Sign out
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => printBadge(row, schoolName)}>
                  Badge
                </Button>
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
              {row.phone ? ` · ${row.phone}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
