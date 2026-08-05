"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export type FeeReminderRuleRow = {
  id: string;
  name: string;
  daysOffset: number;
  channel: string;
  isEnabled: boolean;
  emailTemplate: string | null;
  smsTemplate: string | null;
  timingLabel: string;
};

export type FeeReminderDispatchRow = {
  id: string;
  channel: string;
  dispatchedAt: string;
  ruleName: string;
  timingLabel: string;
  invoiceNumber: string;
  studentName: string;
  studentNumber: string;
};

interface FeeReminderRulesManagerProps {
  schoolId: string;
  rules: FeeReminderRuleRow[];
  recentDispatches: FeeReminderDispatchRow[];
}

export function FeeReminderRulesManager({
  schoolId,
  rules,
  recentDispatches,
}: FeeReminderRulesManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function createRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/fee-reminder-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: form.get("name"),
          daysOffset: parseInt(form.get("daysOffset") as string, 10),
          channel: form.get("channel"),
          isEnabled: form.get("isEnabled") === "on",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      toast.success("Reminder rule added");
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setLoading(null);
    }
  }

  async function toggleEnabled(id: string, isEnabled: boolean) {
    setLoading(id);
    try {
      const res = await fetch(`/api/fee-reminder-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(isEnabled ? "Rule enabled" : "Rule disabled");
      router.refresh();
    } catch {
      toast.error("Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function updateChannel(id: string, channel: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/fee-reminder-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this reminder rule?")) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/fee-reminder-rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Rule deleted");
      router.refresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoading(null);
    }
  }

  async function runNow() {
    setLoading("run");
    try {
      const res = await fetch("/api/fee-reminder-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", schoolId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(
        `Run complete: ${data.summary.sent} sent, ${data.summary.skipped} skipped, ${data.summary.failed} failed`
      );
      router.refresh();
    } catch {
      toast.error("Failed to run reminder rules");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Automated reminder rules</CardTitle>
            <p className="text-sm text-muted mt-1">
              Schedule reminders relative to invoice due dates. Negative days =
              before due; positive = overdue. Templates support{" "}
              <code className="text-xs">{"{{studentName}}"}</code>,{" "}
              <code className="text-xs">{"{{balance}}"}</code>,{" "}
              <code className="text-xs">{"{{dueDate}}"}</code>,{" "}
              <code className="text-xs">{"{{invoiceNumber}}"}</code>.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={runNow}
            disabled={loading === "run"}
          >
            {loading === "run" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run now
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">Timing</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Enabled</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t">
                    <td className="px-3 py-2">{rule.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{rule.timingLabel}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={rule.channel}
                        disabled={loading === rule.id}
                        onChange={(e) => updateChannel(rule.id, e.target.value)}
                      >
                        <option value="EMAIL">Email</option>
                        <option value="SMS">SMS</option>
                        <option value="BOTH">Both</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.isEnabled}
                          disabled={loading === rule.id}
                          onChange={(e) =>
                            toggleEnabled(rule.id, e.target.checked)
                          }
                        />
                        {rule.isEnabled ? "On" : "Off"}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                        disabled={loading === rule.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted"
                    >
                      No rules yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={createRule}
            className="grid gap-3 md:grid-cols-5 items-end border-t pt-4"
          >
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                name="name"
                required
                placeholder="7 days overdue"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-offset">Days offset</Label>
              <Input
                id="rule-offset"
                name="daysOffset"
                type="number"
                required
                defaultValue={7}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-channel">Channel</Label>
              <Select id="rule-channel" name="channel" defaultValue="EMAIL">
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Both</option>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="isEnabled" />
                Enable
              </label>
              <Button type="submit" disabled={loading === "create"}>
                {loading === "create" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent automated dispatches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Invoice</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                </tr>
              </thead>
              <tbody>
                {recentDispatches.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">{formatDate(d.dispatchedAt)}</td>
                    <td className="px-3 py-2">
                      {d.studentName}
                      <span className="block text-xs text-muted">
                        {d.studentNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2">{d.invoiceNumber}</td>
                    <td className="px-3 py-2">
                      {d.ruleName}
                      <span className="block text-xs text-muted">
                        {d.timingLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{d.channel}</Badge>
                    </td>
                  </tr>
                ))}
                {recentDispatches.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted"
                    >
                      No automated reminders sent yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
