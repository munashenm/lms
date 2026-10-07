"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_LICENSE_FEATURES,
  LICENSE_FEATURE_KEYS,
  LICENSE_FEATURE_LABELS,
} from "@/lib/licensing/features";

type Filter =
  | "all"
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "suspended"
  | "revoked"
  | "trials_expiring_soon";

type Summary = {
  totalInstitutions: number;
  activePaid: number;
  trials: number;
  trialsExpiringSoon: number;
  grace: number;
  expired: number;
  suspended: number;
  revoked: number;
  activeLearners: number;
  estimatedMrr: string;
  projectedTrialRevenue: string;
};

type Row = {
  schoolId: string;
  name: string;
  slug: string;
  effectiveStatus: string;
  planName: string | null;
  planCode: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  daysRemainingInGrace: number | null;
  activeLearners: number;
  maxLearners: number | null;
  pricePerLearner: string | null;
  estimatedMonthly: string | null;
  projectedAfterConversion: string | null;
  enabledFeatures: string[];
  restricted: boolean;
};

function statusVariant(status: string): "success" | "warning" | "danger" | "secondary" {
  if (status === "ACTIVE" || status === "TRIAL") return "success";
  if (status === "GRACE") return "warning";
  if (status === "EXPIRED" || status === "SUSPENDED" || status === "REVOKED") return "danger";
  return "secondary";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "trial", label: "Trial" },
  { id: "active", label: "Active" },
  { id: "grace", label: "Grace" },
  { id: "expired", label: "Expired" },
  { id: "suspended", label: "Suspended" },
  { id: "revoked", label: "Revoked" },
  { id: "trials_expiring_soon", label: "Trials ≤30 days" },
];

export function LicensingControlCentre() {
  const [filter, setFilter] = useState<Filter>("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestedRate, setSuggestedRate] = useState("7.00");
  const [loading, setLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [rate, setRate] = useState("");
  const [features, setFeatures] = useState({ ...DEFAULT_LICENSE_FEATURES });
  const [reason, setReason] = useState("");

  async function load(nextFilter = filter) {
    const res = await fetch(`/api/admin/licensing?filter=${nextFilter}`);
    if (!res.ok) {
      toast.error("Unable to load licensing portfolio");
      return;
    }
    const json = await res.json();
    setSummary(json.summary);
    setRows(json.institutions ?? []);
    if (json.defaults?.suggestedPricePerLearner) {
      setSuggestedRate(json.defaults.suggestedPricePerLearner);
    }
  }

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function act(schoolId: string, body: Record<string, unknown>, label: string) {
    setLoading(`${schoolId}-${label}`);
    try {
      const res = await fetch(`/api/admin/licensing/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason: reason || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Action failed");
        return;
      }
      toast.success("Licence updated");
      setReason("");
      await load(filter);
      if (selected?.schoolId === schoolId) {
        const detail = rows.find((r) => r.schoolId === schoolId);
        if (detail) setSelected(detail);
      }
    } finally {
      setLoading(null);
    }
  }

  function openRow(row: Row) {
    setSelected(row);
    setRate(row.pricePerLearner ?? suggestedRate);
    setExtendDate(row.expiresAt ? row.expiresAt.slice(0, 10) : "");
    const next = { ...DEFAULT_LICENSE_FEATURES };
    for (const key of LICENSE_FEATURE_KEYS) {
      next[key] = row.enabledFeatures.includes(key);
    }
    setFeatures(next);
  }

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {[
            ["Total institutions", summary.totalInstitutions],
            ["Active paid", summary.activePaid],
            ["Trials", summary.trials],
            ["Trials expiring soon", summary.trialsExpiringSoon],
            ["Grace", summary.grace],
            ["Expired", summary.expired],
            ["Suspended", summary.suspended],
            ["Active learners", summary.activeLearners],
            ["Estimated MRR", summary.estimatedMrr],
            ["Trial projected", summary.projectedTrialRevenue],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-muted">{label}</p>
                <p className="text-xl font-semibold mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={filter === item.id ? "default" : "outline"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Institutions</CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No institutions match this filter.</p>
          ) : (
            rows.map((row) => (
              <div key={row.schoolId} className="px-4 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.name}</p>
                    <Badge variant={statusVariant(row.effectiveStatus)}>{row.effectiveStatus}</Badge>
                    {row.restricted ? <Badge variant="danger">Restricted</Badge> : null}
                  </div>
                  <p className="text-xs text-muted">
                    {row.planName ?? row.planCode ?? "No plan"} · {row.activeLearners} active learners
                    {row.maxLearners != null ? ` / ${row.maxLearners} max` : ""} · Rate{" "}
                    {row.pricePerLearner ? `R${row.pricePerLearner}` : "not set"}
                    {row.expiresAt ? ` · Expires ${row.expiresAt.slice(0, 10)}` : ""}
                    {row.estimatedMonthly ? ` · ${row.estimatedMonthly}/mo` : ""}
                    {row.projectedAfterConversion ? ` · Projected ${row.projectedAfterConversion}/mo` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openRow(row)}>
                    Manage
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/settings/licence?schoolId=${row.schoolId}`}>Licence page</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.name} — licence controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason / notes (optional)</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="extendDate">Extend trial to</Label>
                <Input
                  id="extendDate"
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                />
              </div>
              <Button
                disabled={loading !== null || !extendDate}
                onClick={() =>
                  act(selected.schoolId, { action: "extend_trial", expiresAt: extendDate }, "extend")
                }
              >
                Extend trial
              </Button>
              <Button
                variant="outline"
                disabled={loading !== null}
                onClick={() =>
                  act(
                    selected.schoolId,
                    {
                      action: "convert_to_paid",
                      planCode: "standard",
                      pricePerLearner: rate || suggestedRate,
                    },
                    "convert"
                  )
                }
              >
                Convert to paid
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="rate">Price per ACTIVE learner (ZAR)</Label>
                <Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={suggestedRate} />
              </div>
              <Button
                disabled={loading !== null}
                onClick={() =>
                  act(selected.schoolId, { action: "change_rate", pricePerLearner: rate }, "rate")
                }
              >
                Change rate
              </Button>
              <Select
                value=""
                onChange={(e) => {
                  const action = e.target.value;
                  if (!action) return;
                  void act(selected.schoolId, { action }, action);
                }}
              >
                <option value="">Lifecycle…</option>
                <option value="suspend">Suspend</option>
                <option value="reactivate">Reactivate</option>
                <option value="revoke">Revoke (cancel)</option>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Licence features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {LICENSE_FEATURE_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={features[key]}
                      onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
                    />
                    {LICENSE_FEATURE_LABELS[key]}
                  </label>
                ))}
              </div>
              <Button
                className="mt-3"
                disabled={loading !== null}
                onClick={() =>
                  act(selected.schoolId, { action: "update_features", features }, "features")
                }
              >
                Save features
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
