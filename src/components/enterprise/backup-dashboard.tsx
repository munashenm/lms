"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type BackupJob = {
  id: string;
  type: string;
  status: string;
  sizeBytes: string;
  createdAt: string;
  applicationVersion: string;
  filename: string | null;
  createdBy: { firstName: string; lastName: string } | null;
};

type Health = {
  lastSuccessfulBackup: string | null;
  nextScheduledBackup: string | null;
  cloudBackups: number;
  offlineBackups: number;
  totalStorageBytes: number;
  oldestRestorePoint: string | null;
  latestRestorePoint: string | null;
  status: string;
};

export function BackupDashboard({ schoolId }: { schoolId?: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [schedules, setSchedules] = useState<{ frequency: string; retainCount: number; enabled: boolean }[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const qs = schoolId ? `?schoolId=${schoolId}` : "";
    const res = await fetch(`/api/backups${qs}`);
    if (!res.ok) return;
    const json = await res.json();
    setHealth(json.health);
    setJobs(json.jobs);
    setSchedules(json.schedules);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load backup dashboard on mount
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function createBackup(type: "CLOUD_MANUAL" | "OFFLINE") {
    setLoading(type);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, type }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Backup failed");
        return;
      }
      toast.success(type === "OFFLINE" ? "Offline backup created" : "Cloud backup created");
      await load();
      if (type === "OFFLINE") {
        window.location.href = `/api/backups/${json.jobId}?download=1${schoolId ? `&schoolId=${schoolId}` : ""}`;
      }
    } finally {
      setLoading(null);
    }
  }

  async function act(id: string, action: "verify" | "delete") {
    if (action === "delete" && confirmDelete !== id) {
      setConfirmDelete(id);
      toast.message("Click delete again to confirm");
      return;
    }
    setLoading(id);
    try {
      if (action === "verify") {
        const res = await fetch(`/api/backups/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, action: "verify" }),
        });
        const json = await res.json();
        toast[json.ok ? "success" : "error"](json.ok ? "Backup verified" : json.error);
      } else {
        const res = await fetch(`/api/backups/${id}?schoolId=${schoolId ?? ""}`, { method: "DELETE" });
        if (!res.ok) toast.error("Delete failed");
        else toast.success("Backup deleted");
        setConfirmDelete(null);
      }
      await load();
    } finally {
      setLoading(null);
    }
  }

  async function saveSchedule(frequency: string, retainCount: number, enabled: boolean) {
    await fetch("/api/backups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, frequency, retainCount, enabled }),
    });
    toast.success("Schedule updated");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat title="Backup health" value={health?.status ?? "—"} />
        <Stat title="Last successful backup" value={health?.lastSuccessfulBackup ? formatDate(health.lastSuccessfulBackup) : "Never"} />
        <Stat title="Next scheduled backup" value={health?.nextScheduledBackup ? formatDate(health.nextScheduledBackup) : "—"} />
        <Stat title="Total backup storage" value={health ? `${(health.totalStorageBytes / (1024 * 1024)).toFixed(1)} MB` : "—"} />
        <Stat title="Cloud backups available" value={String(health?.cloudBackups ?? 0)} />
        <Stat title="Offline backups generated" value={String(health?.offlineBackups ?? 0)} />
        <Stat title="Oldest restore point" value={health?.oldestRestorePoint ? formatDate(health.oldestRestorePoint) : "—"} />
        <Stat title="Latest restore point" value={health?.latestRestorePoint ? formatDate(health.latestRestorePoint) : "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => createBackup("CLOUD_MANUAL")} disabled={Boolean(loading)}>
          Create cloud backup
        </Button>
        <Button variant="outline" onClick={() => createBackup("OFFLINE")} disabled={Boolean(loading)}>
          Create Offline Backup
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/admin/settings/backup/restore${schoolId ? `?schoolId=${schoolId}` : ""}`}>
            Restore backup
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedules & retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {schedules.map((s) => (
            <div key={s.frequency} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0">
              <span className="w-24 font-medium">{s.frequency}</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => saveSchedule(s.frequency, s.retainCount, e.target.checked)}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2">
                Retain
                <input
                  type="number"
                  className="h-9 w-20 rounded-lg border border-border px-2"
                  defaultValue={s.retainCount}
                  onBlur={(e) => saveSchedule(s.frequency, Number(e.target.value), s.enabled)}
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent backups</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Date</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created by</th>
                <th>Status</th>
                <th>App version</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="py-2">{formatDate(job.createdAt)}</td>
                  <td>{job.type.replaceAll("_", " ")}</td>
                  <td>{(Number(job.sizeBytes) / (1024 * 1024)).toFixed(2)} MB</td>
                  <td>{job.createdBy ? `${job.createdBy.firstName} ${job.createdBy.lastName}` : "System"}</td>
                  <td>
                    <Badge variant={job.status === "FAILED" ? "danger" : job.status === "SUCCEEDED" || job.status === "VERIFIED" ? "success" : "secondary"}>
                      {job.status}
                    </Badge>
                  </td>
                  <td>{job.applicationVersion}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <Link className="text-primary text-xs" href={`/admin/settings/backup/restore?backupId=${job.id}${schoolId ? `&schoolId=${schoolId}` : ""}`}>
                      Restore
                    </Link>
                    <a className="text-primary text-xs" href={`/api/backups/${job.id}?download=1${schoolId ? `&schoolId=${schoolId}` : ""}`}>
                      Download
                    </a>
                    <button className="text-primary text-xs" onClick={() => act(job.id, "verify")}>Verify</button>
                    <button className="text-danger text-xs" onClick={() => act(job.id, "delete")}>
                      {confirmDelete === job.id ? "Confirm delete" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && <p className="text-sm text-muted py-6 text-center">No backups yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted">{title}</p>
        <p className="text-lg font-semibold mt-1 capitalize">{value}</p>
      </CardContent>
    </Card>
  );
}
