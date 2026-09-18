"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface SmsLog {
  id: string;
  recipientName: string | null;
  recipientContact: string;
  message: string;
  status: string;
  provider: string | null;
  providerMessageId: string | null;
  createdAt: string;
  error: string | null;
}

export function SmsConsole({
  classes,
  grades,
}: {
  classes: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
}) {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [audience, setAudience] = useState("INDIVIDUAL");

  async function load() {
    const res = await fetch("/api/sms");
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.logs ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load SMS history on mount
    void load();
  }, []);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const payload: Record<string, string | undefined> = {
        message: String(form.get("message") ?? ""),
        recipientName: String(form.get("recipientName") || "") || undefined,
      };
      if (audience === "INDIVIDUAL") {
        payload.to = String(form.get("to") ?? "");
      } else {
        payload.audience = audience;
        payload.classId = String(form.get("classId") ?? "") || undefined;
        payload.gradeId = String(form.get("gradeId") ?? "") || undefined;
      }
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.log?.error ?? "SMS failed");
      toast.success(data.count ? `SMS sent to ${data.count} recipients` : "SMS queued/sent");
      e.currentTarget.reset();
      setAudience("INDIVIDUAL");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SMS failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Send SMS</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={send} className="space-y-3">
            <div className="space-y-2">
              <Label>Audience</Label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="INDIVIDUAL">Individual number</option>
                <option value="CLASS">Class</option>
                <option value="GRADE">Grade</option>
                <option value="STAFF">Staff</option>
                <option value="PARENTS">Parents</option>
                <option value="STUDENTS">Students</option>
              </select>
            </div>
            {audience === "INDIVIDUAL" ? (
              <>
                <div className="space-y-2">
                  <Label>Recipient name</Label>
                  <Input name="recipientName" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile number</Label>
                  <Input name="to" required placeholder="0821234567" />
                </div>
              </>
            ) : null}
            {audience === "CLASS" ? (
              <div className="space-y-2">
                <Label>Class</Label>
                <select name="classId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {audience === "GRADE" ? (
              <div className="space-y-2">
                <Label>Grade</Label>
                <select name="gradeId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                  <option value="">Select grade</option>
                  {grades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea name="message" required maxLength={1600} rows={5} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            </div>
            <Button type="submit" disabled={loading}>
              Send SMS
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">SMS history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted">No SMS yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{log.recipientName || log.recipientContact}</p>
                  <Badge>{log.status}</Badge>
                </div>
                <p className="text-xs text-muted mt-1">
                  {log.recipientContact} · {formatDateTime(log.createdAt)} · {log.provider ?? "provider"}
                </p>
                <p className="text-sm mt-2 whitespace-pre-wrap">{log.message}</p>
                {log.error ? <p className="text-xs text-danger mt-1">{log.error}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
