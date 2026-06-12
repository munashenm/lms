"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";

export function LeaveRequestForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [leaveType, setLeaveType] = useState("ANNUAL");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Leave request submitted");
      router.refresh();
      form.reset();
      setLeaveType("ANNUAL");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Request Leave</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            <Select
              name="type"
              required
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              <option value="ANNUAL">Annual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="FAMILY">Family Responsibility</option>
              <option value="UNPAID">Unpaid Leave</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input name="startDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Input name="endDate" type="date" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reason *</Label>
            <textarea
              name="reason"
              rows={3}
              required
              minLength={5}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Brief reason for leave request..."
            />
          </div>
          {leaveType === "SICK" && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Sick Note / Doctor&apos;s Certificate *</Label>
              <div className="flex items-center gap-3">
                <Input
                  name="sickNote"
                  type="file"
                  required
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="cursor-pointer"
                />
              </div>
              <p className="text-xs text-muted flex items-center gap-1">
                <Upload className="h-3 w-3" />
                PDF or image, max 5 MB — required for sick leave
              </p>
            </div>
          )}
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
