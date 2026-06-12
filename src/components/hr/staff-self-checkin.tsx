"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type SelfStatus = "PRESENT" | "LATE" | "REMOTE";

interface StaffSelfCheckinProps {
  today: string;
  existing?: {
    status: string;
    checkIn?: string | null;
  } | null;
  onApprovedLeave?: boolean;
}

const OPTIONS: {
  value: SelfStatus;
  label: string;
  description: string;
  variant: "success" | "warning" | "default";
}[] = [
  { value: "PRESENT", label: "Present", description: "On campus today", variant: "success" },
  { value: "LATE", label: "Late", description: "Arrived after start time", variant: "warning" },
  { value: "REMOTE", label: "Remote", description: "Working off-site", variant: "default" },
];

export function StaffSelfCheckin({
  today,
  existing,
  onApprovedLeave,
}: StaffSelfCheckinProps) {
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(existing ?? null);

  async function checkIn(status: SelfStatus) {
    setLoading(true);
    try {
      const res = await fetch("/api/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self: true, status }),
      });
      if (!res.ok) throw new Error("Check-in failed");
      const data = await res.json();
      setRecord({ status: data.record.status, checkIn: data.checkIn });
      toast.success(`Checked in as ${status.toLowerCase()} at ${data.checkIn}`);
    } catch {
      toast.error("Failed to check in");
    } finally {
      setLoading(false);
    }
  }

  if (onApprovedLeave) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <Badge variant="secondary">On approved leave</Badge>
          <p className="text-sm text-muted">
            You have approved leave for {today}. No check-in is required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {record && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Today&apos;s check-in</p>
              <p className="text-sm text-muted">
                {record.status}
                {record.checkIn ? ` · ${record.checkIn}` : ""}
              </p>
            </div>
            <Badge
              variant={
                record.status === "PRESENT"
                  ? "success"
                  : record.status === "LATE"
                    ? "warning"
                    : "default"
              }
            >
              Recorded
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <Card key={opt.value} className="hover:border-primary/40 transition-colors">
            <CardContent className="py-5 space-y-3">
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted mt-1">{opt.description}</p>
              </div>
              <Button
                size="sm"
                variant={record?.status === opt.value ? "default" : "outline"}
                className="w-full"
                disabled={loading}
                onClick={() => checkIn(opt.value)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
