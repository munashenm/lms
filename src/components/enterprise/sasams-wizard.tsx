"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { LMS_TARGET_FIELDS, type ImportEntityType } from "@/lib/integrations/sasams/types";

const STEPS = [
  "Upload source",
  "Analyse",
  "Validation",
  "Mapping",
  "Duplicates",
  "Preview",
  "Import",
];

export function SaSamsWizard({ schoolId }: { schoolId?: string }) {
  const [step, setStep] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [validation, setValidation] = useState<{ errors: number; warnings: number } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<{ sourceField: string; entityType: ImportEntityType; targetField: string }[]>([]);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<string>("");

  async function loadHistory() {
    const qs = schoolId ? `?schoolId=${schoolId}` : "";
    const res = await fetch(`/api/integrations/sasams${qs}`);
    if (res.ok) {
      const json = await res.json();
      setHistory(json.jobs);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load import history on mount
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function postAction(action: string, extra?: Record<string, unknown>) {
    const res = await fetch("/api/integrations/sasams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId, schoolId, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Request failed");
    return json;
  }

  async function upload() {
    if (!file) return toast.error("Choose a file first");
    setLoading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const qs = schoolId ? `?schoolId=${schoolId}` : "";
      const res = await fetch(`/api/integrations/sasams${qs}`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Upload failed");
        return;
      }
      setJobId(json.job.id);
      toast.success("File uploaded securely");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function analyse() {
    setLoading(true);
    try {
      const json = await postAction("analyse");
      setAnalysis(json);
      const sheet = json.parsed?.sheets?.[0];
      if (sheet?.headers) {
        setHeaders(sheet.headers);
        setMappings(
          sheet.headers.map((h: string) => ({
            sourceField: h,
            entityType: "learner" as ImportEntityType,
            targetField: "",
          }))
        );
      }
      toast.success("Source analysed into staging tables");
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse failed");
    } finally {
      setLoading(false);
    }
  }

  async function validate() {
    setLoading(true);
    try {
      const json = await postAction("validate");
      setValidation(json);
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveMap() {
    setLoading(true);
    try {
      await postAction("map", { mappings, mappingName: "SA-SAMS generic" });
      toast.success("Mapping saved");
      setStep(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mapping failed");
    } finally {
      setLoading(false);
    }
  }

  async function duplicates() {
    setLoading(true);
    try {
      const json = await postAction("duplicates");
      setPreview(json);
      setStep(6);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate detection failed");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    setLoading(true);
    try {
      const json = await postAction("execute");
      toast.success(`Import finished: ${json.created} created, ${json.updated} updated`);
      setStep(7);
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function testApi() {
    const json = await postAction("test-api");
    setApiStatus(json.message);
  }

  const counts = (analysis?.counts ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <Badge key={label} variant={step === i + 1 ? "default" : "secondary"}>
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Upload source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Upload a school-authorised SA-SAMS export. CSV, TSV, JSON and Excel (.xlsx) are supported.
              Native SA-SAMS database files will be added after we inspect a sample — this wizard will not
              guess unpublished table structures.
            </p>
            <input type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button onClick={upload} disabled={loading || !file}>Upload</Button>
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium">Method B — future official API</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={testApi}>
                Test API connection
              </Button>
              {apiStatus && <p className="text-xs text-muted mt-2">{apiStatus}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Analyse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={analyse} disabled={loading}>Analyse into staging</Button>
          </CardContent>
        </Card>
      )}

      {analysis && step >= 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recognised records</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(counts).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted capitalize">{k.replaceAll("_", " ")}</p>
                <p className="font-semibold">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3 — Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={validate} disabled={loading}>Run validation</Button>
            {validation && (
              <p className="text-sm">{validation.errors} errors · {validation.warnings} warnings. Errors block the affected records only.</p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 4 — Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {headers.map((header, i) => (
              <div key={header} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-sm">
                <span className="font-medium">{header}</span>
                <Select
                  value={mappings[i]?.entityType ?? "learner"}
                  onChange={(e) => {
                    const next = [...mappings];
                    next[i] = { ...next[i], entityType: e.target.value as ImportEntityType };
                    setMappings(next);
                  }}
                >
                  {Object.keys(LMS_TARGET_FIELDS).map((ent) => (
                    <option key={ent} value={ent}>{ent}</option>
                  ))}
                </Select>
                <Select
                  value={mappings[i]?.targetField ?? ""}
                  onChange={(e) => {
                    const next = [...mappings];
                    next[i] = { ...next[i], targetField: e.target.value };
                    setMappings(next);
                  }}
                >
                  <option value="">Ignore</option>
                  {(LMS_TARGET_FIELDS[mappings[i]?.entityType ?? "learner"] ?? []).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </Select>
              </div>
            ))}
            <Button onClick={saveMap} disabled={loading}>Save mapping</Button>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 5 — Duplicate detection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">
              Matches use national ID, passport, admission number, or name + surname + date of birth.
              Duplicates are never created silently.
            </p>
            <Button onClick={duplicates} disabled={loading}>Detect duplicates</Button>
          </CardContent>
        </Card>
      )}

      {step === 6 && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 6 — Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(preview).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="capitalize">{k.replace(/[A-Z]/g, (m) => ` ${m}`)}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            <Button onClick={execute} disabled={loading}>Start final import</Button>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import complete</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Records retain source_system = SA-SAMS, source record id, batch id, and importer metadata.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Import ID</th>
                <th>Source</th>
                <th>Filename</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((job) => (
                <tr key={String(job.id)} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{String(job.id).slice(0, 8)}</td>
                  <td>{String(job.providerCode)}</td>
                  <td>{String(job.filename)}</td>
                  <td>{String(job.status)}</td>
                  <td>
                    <Link className="text-primary text-xs" href={`/admin/integrations/sa-sams/${job.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
