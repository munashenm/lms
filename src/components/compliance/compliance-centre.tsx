"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Issue = {
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  entityType: string;
  entityId: string;
  field?: string;
};

type Summary = {
  errorCount: number;
  warningCount: number;
  blocking: boolean;
  affectedLearners: number;
  affectedEducators: number;
  readyForExport: boolean;
  activeLearners: number;
  activeEducators: number;
};

export function ComplianceCentre() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [lastExport, setLastExport] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/summary");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load compliance");
      setSummary(data.summary);
      setIssues(data.issues ?? []);
      setSchoolName(data.school?.name ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load compliance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState after fetch is not synchronous inside the effect body.
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  async function runExport(kind: string, allowWithErrors = false) {
    setBusy(kind);
    try {
      const res = await fetch("/api/compliance/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, format: "csv", allowWithErrors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Export failed");
      setLastExport(data.job?.filename ?? kind);
      if (data.csv) {
        downloadText(data.job?.filename ?? `${kind}.csv`, data.csv, "text/csv");
      } else if (data.csvBundle) {
        downloadText(
          (data.job?.filename ?? "sa-sams-export.json").replace(/\.json$/, "-bundle.json"),
          JSON.stringify(data.csvBundle, null, 2),
          "application/json"
        );
      } else if (data.package) {
        downloadText(
          data.job?.filename ?? "export.json",
          JSON.stringify(data.package, null, 2),
          "application/json"
        );
      }
      toast.success("Export ready — file downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function importLurits(file: File) {
    setBusy("lurits");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/compliance/lurits", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      toast.success(
        `LURITS import complete — ${data.summary?.updated ?? 0} updated, ${data.summary?.unmatched ?? 0} unmatched`
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Checking EMIS readiness…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance summary{schoolName ? ` — ${schoolName}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Stat label="Active learners" value={summary?.activeLearners ?? 0} />
          <Stat label="Active educators" value={summary?.activeEducators ?? 0} />
          <Stat
            label="Blocking errors"
            value={summary?.errorCount ?? 0}
            tone={(summary?.errorCount ?? 0) > 0 ? "danger" : "ok"}
          />
          <Stat label="Warnings" value={summary?.warningCount ?? 0} tone="warn" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void refresh()} disabled={!!busy}>
          Refresh checks
        </Button>
        <Button
          onClick={() => void runExport("SASAMS_PACKAGE", false)}
          disabled={!!busy || Boolean(summary?.blocking)}
        >
          {busy === "SASAMS_PACKAGE" ? "Exporting…" : "Export SA-SAMS package"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void runExport("SASAMS_PACKAGE", true)}
          disabled={!!busy}
        >
          Export with warnings/errors
        </Button>
        <Button variant="outline" onClick={() => void runExport("CEMIS_MARKS")} disabled={!!busy}>
          {busy === "CEMIS_MARKS" ? "Exporting…" : "CEMIS marks (MVP)"}
        </Button>
        <Button variant="outline" onClick={() => void runExport("LURITS_PROMOTION")} disabled={!!busy}>
          {busy === "LURITS_PROMOTION" ? "Exporting…" : "Promotion → LURITS"}
        </Button>
        <label className="inline-flex">
          <input
            type="file"
            accept=".xml,.csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importLurits(file);
              e.currentTarget.value = "";
            }}
          />
          <Button variant="secondary" asChild disabled={!!busy}>
            <span>{busy === "lurits" ? "Importing…" : "Import LURITS feedback"}</span>
          </Button>
        </label>
      </div>

      {lastExport ? (
        <p className="text-xs text-muted">Last export file: {lastExport}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {issues.length === 0 ? (
            <p className="text-sm text-muted">No outstanding compliance items for active records.</p>
          ) : (
            <ul className="divide-y divide-border">
              {issues.slice(0, 100).map((issue, index) => (
                <li key={`${issue.entityId}-${issue.code}-${index}`} className="py-2 flex gap-3 text-sm">
                  <Badge variant={issue.severity === "ERROR" ? "danger" : "warning"}>{issue.severity}</Badge>
                  <div>
                    <p>{issue.message}</p>
                    <p className="text-xs text-muted">
                      {issue.entityType}
                      {issue.field ? ` · ${issue.field}` : ""} · {issue.code}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {issues.length > 100 ? (
            <p className="text-xs text-muted">Showing first 100 of {issues.length} issues.</p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted">
        SchoolHub remains the operational system of record. Deploy SA-SAMS packages through SA-SAMS /
        Valistractor for district filing. Native Access database export remains a placeholder until an
        authorised sample is available.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-amber-700" : "text-foreground";
  return (
    <div>
      <p className="text-muted text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}