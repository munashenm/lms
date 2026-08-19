"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

type LicensePayload = {
  institution: { id: string; name: string; slug: string };
  license: {
    licenseKey: string;
    product: string;
    plan: string | null;
    status: string;
    issueDate: string | null;
    startDate: string | null;
    expiryDate: string | null;
    gracePeriodDays: number;
    lastVerifiedAt: string | null;
    nextVerificationAt: string | null;
    installationId: string;
    registeredDomain: string | null;
    limits: {
      learners: { used: number; max: number | null };
      staff: { used: number; max: number | null };
      administrators: { used: number; max: number | null };
      campuses: { used: number; max: number | null };
      storage: { used: number; max: string | null };
    };
    features: { key: string; label: string; enabled: boolean; future?: boolean; note?: string | null }[];
  } | null;
  evaluation: {
    effectiveStatus: string;
    restricted: boolean;
    warnings: string[];
    usingCache: boolean;
    serverUnavailable: boolean;
  };
  serverConfigured: boolean;
};

function statusVariant(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "ACTIVE" || status === "TRIAL") return "success";
  if (status === "GRACE") return "warning";
  if (status === "EXPIRED" || status === "SUSPENDED" || status === "REVOKED") return "danger";
  return "default";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function LicenceManager({ schoolId }: { schoolId?: string }) {
  const [data, setData] = useState<LicensePayload | null>(null);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const qs = schoolId ? `?schoolId=${schoolId}` : "";
    const res = await fetch(`/api/license${qs}`);
    if (!res.ok) {
      toast.error("Unable to load licence");
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load remote licence on mount
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function activate() {
    setLoading(true);
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key, schoolId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Activation failed");
        return;
      }
      toast.success("Licence activated");
      setKey("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function check(force = true) {
    setLoading(true);
    try {
      const res = await fetch("/api/license/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, force }),
      });
      if (!res.ok) toast.error("Verification failed");
      else toast.success("Licence verified");
      await load();
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <p className="text-sm text-muted">Loading licence…</p>;
  const license = data.license;

  return (
    <div className="space-y-6">
      {data.evaluation.warnings.map((w) => (
        <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {w}
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activate licence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="licenseKey">Licence key</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="licenseKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="SHSA-XXXX-XXXX-XXXX"
            />
            <Button onClick={activate} disabled={loading || !key.trim()}>
              Activate Licence
            </Button>
            <Button variant="outline" onClick={() => check(true)} disabled={loading}>
              Verify now
            </Button>
          </div>
          <p className="text-xs text-muted">
            {data.serverConfigured
              ? "This installation will verify the key against the central licence server and cache a signed response."
              : "No licence server is configured. A local trial licence is used until LICENSE_PUBLIC_KEY and LICENSE_SERVER_URL are set."}
          </p>
        </CardContent>
      </Card>

      {license && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Current licence</CardTitle>
            <Badge variant={statusVariant(data.evaluation.effectiveStatus)}>
              {data.evaluation.effectiveStatus}
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Institution" value={data.institution.name} />
            <Field label="Licence key" value={license.licenseKey} />
            <Field label="Product" value={license.product} />
            <Field label="Plan" value={license.plan ?? "—"} />
            <Field label="Issue date" value={license.issueDate ? formatDate(license.issueDate) : "—"} />
            <Field label="Expiry date" value={license.expiryDate ? formatDate(license.expiryDate) : "—"} />
            <Field label="Grace period" value={`${license.gracePeriodDays} days`} />
            <Field
              label="Active learners"
              value={`${license.limits.learners.used} / ${license.limits.learners.max ?? "unlimited"}`}
            />
            <Field
              label="Staff"
              value={`${license.limits.staff.used} / ${license.limits.staff.max ?? "unlimited"}`}
            />
            <Field
              label="Administrators"
              value={`${license.limits.administrators.used} / ${license.limits.administrators.max ?? "unlimited"}`}
            />
            <Field
              label="Campuses"
              value={`${license.limits.campuses.used} / ${license.limits.campuses.max ?? "unlimited"}`}
            />
            <Field
              label="Storage"
              value={`${formatBytes(license.limits.storage.used)} / ${
                license.limits.storage.max ? formatBytes(Number(license.limits.storage.max)) : "unlimited"
              }`}
            />
            <Field
              label="Last verification"
              value={license.lastVerifiedAt ? formatDate(license.lastVerifiedAt) : "—"}
            />
            <Field
              label="Next verification"
              value={license.nextVerificationAt ? formatDate(license.nextVerificationAt) : "—"}
            />
            <Field label="Installation ID" value={license.installationId} />
            <Field label="Registered domain" value={license.registeredDomain ?? "—"} />
          </CardContent>
        </Card>
      )}

      {license && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enabled modules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {license.features.map((f) => (
              <Badge key={f.key} variant={f.enabled ? "success" : "secondary"}>
                {f.label}
                {f.future ? " · future" : ""}
              </Badge>
            ))}
            {license.features.some((f) => f.future) ? (
              <p className="w-full text-xs text-muted mt-2">
                {license.features.find((f) => f.future)?.note ??
                  "Future modules are reserved on the licence. They do not unlock unfinished product features."}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium break-all">{value}</p>
    </div>
  );
}
