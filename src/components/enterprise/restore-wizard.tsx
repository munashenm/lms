"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RestoreWizard({
  schoolId,
  backupId,
}: {
  schoolId?: string;
  backupId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<{ id: string; status: string; errorMessage: string | null; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadJobs() {
    const qs = schoolId ? `?schoolId=${schoolId}` : "";
    const res = await fetch(`/api/restore${qs}`);
    if (res.ok) {
      const json = await res.json();
      setJobs(json.jobs);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load restore jobs on mount
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function validate(confirm = false) {
    setLoading(true);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        if (schoolId) form.set("schoolId", schoolId);
        if (restoreJobId) form.set("restoreJobId", restoreJobId);
        form.set("confirm", String(confirm));
        res = await fetch("/api/restore", { method: "POST", body: form });
      } else if (backupId) {
        res = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, backupJobId: backupId, confirm, restoreJobId }),
        });
      } else {
        toast.error("Select a cloud backup or upload an offline .lmsbackup file");
        return;
      }
      const json = await res.json();
      if (json.restoreJobId) setRestoreJobId(json.restoreJobId);
      if (!res.ok) {
        toast.error(json.error ?? json.message ?? "Validation failed");
        setReport(json);
        return;
      }
      setReport(json);
      if (confirm) {
        toast.success(json.ok ? "Restore completed" : "Restore finished with errors");
      } else {
        toast.success("Backup validated. Review the summary before restoring.");
      }
      await loadJobs();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {backupId && <p>Cloud backup selected: <code>{backupId}</code></p>}
          <input
            type="file"
            accept=".lmsbackup,.schoolbackup"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Restoration never overwrites immediately. The backup is validated first, a pre-restore
            recovery backup is created automatically, and a failed restore attempts rollback.
          </div>
          <div className="flex gap-2">
            <Button onClick={() => validate(false)} disabled={loading}>
              Validate backup
            </Button>
            <Button
              variant="destructive"
              onClick={() => validate(true)}
              disabled={loading || !report}
            >
              Restore now
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backup information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto bg-background rounded-lg p-3">
              {JSON.stringify(report.report ?? report, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restore jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between border-b border-border py-2">
              <span>{job.id.slice(0, 8)}…</span>
              <Badge variant={job.status === "COMPLETED" ? "success" : job.status === "FAILED" || job.status === "ROLLED_BACK" ? "danger" : "secondary"}>
                {job.status}
              </Badge>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-muted">No restore jobs yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
