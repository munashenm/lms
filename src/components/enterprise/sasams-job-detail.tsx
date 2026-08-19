"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type JobDetail = {
  id: string;
  filename: string;
  status: string;
  createdAt: string | Date;
  summary: unknown;
  errors: { severity: string; code: string; message: string }[];
  stagingRecords: { id: string; entityType: string; validationStatus: string; duplicateAction: string }[];
  batches: { id: string; createdCount: number; updatedCount: number; skippedCount: number; errorCount: number; status: string }[];
};

export function SaSamsJobDetail({ job, schoolId }: { job: JobDetail; schoolId?: string }) {
  const [status, setStatus] = useState(job.status);
  async function rollback() {
    const res = await fetch("/api/integrations/sasams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rollback", jobId: job.id, schoolId }),
    });
    if (!res.ok) {
      toast.error("Rollback failed");
      return;
    }
    toast.success("Import rolled back");
    setStatus("ROLLED_BACK");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import {job.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted">{job.filename} · {formatDate(job.createdAt)}</p>
        </div>
        <Badge>{status}</Badge>
      </div>
      {status === "COMPLETED" && (
        <Button variant="destructive" onClick={rollback}>Rollback import</Button>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {job.batches.map((b) => (
            <p key={b.id}>
              Created {b.createdCount} · Updated {b.updatedCount} · Skipped {b.skippedCount} · Errors {b.errorCount}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {job.errors.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Badge variant={e.severity === "ERROR" ? "danger" : "warning"}>{e.severity}</Badge>
              <span>{e.code}: {e.message}</span>
            </div>
          ))}
          {job.errors.length === 0 && <p className="text-muted">No issues recorded</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staging records</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Type</th>
                <th>Status</th>
                <th>Duplicate action</th>
              </tr>
            </thead>
            <tbody>
              {job.stagingRecords.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 capitalize">{r.entityType}</td>
                  <td>{r.validationStatus}</td>
                  <td>{r.duplicateAction}</td>
                </tr>
              ))}
              {job.stagingRecords.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-muted">No staging rows loaded</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
