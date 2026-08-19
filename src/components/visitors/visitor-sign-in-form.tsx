"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  VISITOR_HOST_KIND_LABELS,
  VISITOR_IDENTITY_TYPE_LABELS,
  VISITOR_PURPOSE_LABELS,
} from "@/lib/visitors";

export function VisitorSignInForm({
  campuses,
}: {
  campuses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not sign in visitor");
      toast.success("Visitor signed in");
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in visitor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in a visitor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input name="firstName" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input name="lastName" required maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organisation (optional)</Label>
              <Input name="organisation" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input name="phone" placeholder="0821234567" maxLength={10} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID type (optional)</Label>
              <Select name="identityType" defaultValue="">
                <option value="">Not recorded</option>
                {Object.entries(VISITOR_IDENTITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ID / passport no. (optional)</Label>
              <Input name="identityNumber" maxLength={40} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visiting</Label>
              <Select name="hostKind" required defaultValue="STAFF">
                {Object.entries(VISITOR_HOST_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Person / office visiting</Label>
              <Input name="hostName" required maxLength={200} placeholder="e.g. Grade 4, Finance office" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select name="purpose" required defaultValue="PARENT_GUARDIAN">
                {Object.entries(VISITOR_PURPOSE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose detail (optional)</Label>
              <Input name="purposeDetail" maxLength={500} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {campuses.length > 0 ? (
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select name="campusId" defaultValue="">
                  <option value="">Not specified</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Vehicle reg. (optional)</Label>
              <Input name="vehicleRegistration" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Badge / pass no. (optional)</Label>
              <Input name="badgeNumber" maxLength={40} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Personal information is collected for school safety and visitor control in terms of POPIA.
            Identity numbers are stored on the school record and shown masked in this list.
          </p>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
