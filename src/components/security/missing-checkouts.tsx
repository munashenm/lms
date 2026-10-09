"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MissingCheckoutList({
  rows,
  boundary,
}: {
  boundary: string;
  rows: Array<{ kind: "gate" | "visitor"; id: string; name: string; detail: string; since: string; label: string }>;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function reconcile(row: (typeof rows)[number]) {
    const reason = window.prompt(`Missing checkout for ${row.name}. Reason for the reconciliation`, "Forgot to scan out") ?? "";
    if (reason.trim().length < 3) return;
    setPending(row.id);
    const res = await fetch("/api/gate/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        gateEventId: row.kind === "gate" ? row.id : null,
        visitorEntryId: row.kind === "visitor" ? row.id : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(null);
    setNotice(res.ok ? "Recorded as a missing checkout. The original entry was left unchanged." : json.message ?? "Could not reconcile.");
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        After {boundary}, an entry without a matching OUT stays on the register as a missing checkout. It is not counted as currently on site, and no departure scan is invented.
      </p>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? <li className="p-4 text-sm text-muted">No missing checkouts.</li> : null}
        {rows.map((row) => (
          <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-muted">{row.detail} · Missing checkout · since {new Date(row.since).toLocaleString()}</p>
            </div>
            <Button type="button" disabled={pending === row.id} onClick={() => void reconcile(row)}>Reconcile</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
