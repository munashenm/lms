"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GuardianRow {
  id: string;
  relationship: string;
  isPrimary: boolean;
  guardian: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    userId: string | null;
  };
}

export function StudentPortalPanel(props: {
  studentId: string;
  studentEmail: string | null;
  studentUserId: string | null;
  studentStatus: string;
  guardians: GuardianRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function invitePortal() {
    setLoading("portal");
    try {
      const res = await fetch(`/api/students/${props.studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitePortal: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not set up portal");
      if (data.provision?.invitesSent) {
        toast.success(`Portal setup complete. ${data.provision.invitesSent} password setup email(s) sent.`);
      } else if (data.provision?.studentLoginCreated || data.provision?.guardianLinked) {
        toast.success("Portal accounts linked. No new invites were sent.");
      } else {
        toast.success(
          "No new portal accounts created. Add an email, or that address may already belong to another role or school."
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set up portal");
    } finally {
      setLoading(null);
    }
  }

  async function changeStatus(status: string) {
    setLoading("status");
    try {
      const res = await fetch(`/api/students/${props.studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update status");
      toast.success(`Student marked as ${status.toLowerCase()}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
    } finally {
      setLoading(null);
    }
  }

  async function addGuardian(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("guardian");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch(`/api/students/${props.studentId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Could not add guardian");
      toast.success(
        json.provision?.invitesSent
          ? "Guardian linked. Password setup email sent."
          : "Guardian linked"
      );
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add guardian");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Guardians and portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Student portal: {props.studentUserId ? "linked" : "not linked"}
          {props.studentEmail ? ` · ${props.studentEmail}` : ""}
        </p>

        {props.guardians.length === 0 ? (
          <p className="text-sm text-muted">No guardians on this record yet.</p>
        ) : (
          <div className="space-y-3">
            {props.guardians.map((sg) => (
              <div key={sg.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">
                    {sg.guardian.firstName} {sg.guardian.lastName}
                    {sg.isPrimary ? <Badge variant="accent" className="ml-2">Primary</Badge> : null}
                    {sg.guardian.userId ? <Badge variant="success" className="ml-2">Parent portal</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">{sg.relationship}</p>
                </div>
                <p className="text-xs text-muted">{sg.guardian.email ?? sg.guardian.phone ?? "—"}</p>
              </div>
            ))}
          </div>
        )}

        {props.canWrite ? (
          <>
            <form onSubmit={addGuardian} className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="guardianFirstName">Guardian first name</Label><Input id="guardianFirstName" name="firstName" required /></div>
              <div><Label htmlFor="guardianLastName">Guardian last name</Label><Input id="guardianLastName" name="lastName" required /></div>
              <div><Label htmlFor="guardianEmail">Guardian email</Label><Input id="guardianEmail" name="email" type="email" /></div>
              <div><Label htmlFor="guardianPhone">Guardian phone</Label><Input id="guardianPhone" name="phone" placeholder="082 123 4567" /></div>
              <div className="sm:col-span-2"><Label htmlFor="guardianRelationship">Relationship</Label><Input id="guardianRelationship" name="relationship" placeholder="Mother, Father, Guardian" /></div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="outline" disabled={loading === "guardian"}>Add guardian</Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={loading === "portal"} onClick={invitePortal}>
                Set up portal
              </Button>
              {props.studentStatus === "ACTIVE" ? (
                <>
                  <Button type="button" variant="outline" disabled={loading === "status"} onClick={() => changeStatus("SUSPENDED")}>
                    Suspend
                  </Button>
                  <Button type="button" variant="outline" disabled={loading === "status"} onClick={() => changeStatus("WITHDRAWN")}>
                    Withdraw
                  </Button>
                  <Button type="button" variant="outline" disabled={loading === "status"} onClick={() => changeStatus("GRADUATED")}>
                    Graduate
                  </Button>
                </>
              ) : (
                <Button type="button" disabled={loading === "status"} onClick={() => changeStatus("ACTIVE")}>
                  Reactivate
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">
              Suspended, withdrawn or graduated learners lose portal login. Guardians keep theirs if they have other children.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
