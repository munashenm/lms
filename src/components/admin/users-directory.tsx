"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  FINANCE_OFFICER: "Finance officer",
  HR_OFFICER: "HR officer",
  ADMISSIONS_OFFICER: "Admissions officer",
  PRINCIPAL: "Principal",
  SCHOOL_ADMIN: "School admin",
  SUPER_ADMIN: "Super admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

interface DirectoryUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | Date | null;
  schoolName: string | null;
}

interface SchoolOption {
  id: string;
  name: string;
}

export function UsersDirectory({
  users,
  currentUserId,
  canWrite,
  inviteRoles,
  schools,
  showSchoolColumn,
}: {
  users: DirectoryUser[];
  currentUserId: string;
  canWrite: boolean;
  inviteRoles: string[];
  schools: SchoolOption[];
  showSchoolColumn: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: inviteRoles[0] ?? "STAFF",
    schoolId: schools[0]?.id ?? "",
  });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading("invite");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not invite user");
        return;
      }
      toast.success("User invited. Password setup email sent.");
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: inviteRoles[0] ?? "STAFF",
        schoolId: form.schoolId,
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function patchUser(id: string, body: { isActive?: boolean; resendInvite?: boolean }) {
    setLoading(id + (body.resendInvite ? "-resend" : "-active"));
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not update user");
        return;
      }
      if (body.resendInvite) toast.success("Password setup email sent.");
      else toast.success(body.isActive ? "User reactivated" : "User deactivated");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {canWrite && inviteRoles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite user</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {inviteRoles.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role] ?? role}</option>
                  ))}
                </Select>
              </div>
              {schools.length > 1 ? (
                <div>
                  <Label htmlFor="schoolId">School</Label>
                  <Select
                    id="schoolId"
                    value={form.schoolId}
                    onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="flex items-end">
                <Button type="submit" disabled={loading === "invite"} className="w-full">
                  Send invite
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted mt-3">
              Teachers are invited from Staff. Students and parents are invited from the student record.
              Never create a teacher login here without a staff record.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                {showSchoolColumn ? (
                  <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">School</th>
                ) : null}
                <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Last login</th>
                {canWrite ? (
                  <th className="text-left px-4 py-3 font-medium text-muted">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const locked = user.role === "SUPER_ADMIN" || isSelf;
                return (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    {showSchoolColumn ? (
                      <td className="px-4 py-3 text-muted hidden lg:table-cell">{user.schoolName ?? "—"}</td>
                    ) : null}
                    <td className="px-4 py-3">{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={loading === `${user.id}-resend` || !user.isActive}
                            onClick={() => patchUser(user.id, { resendInvite: true })}
                          >
                            Resend
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={user.isActive ? "outline" : "default"}
                            disabled={loading === `${user.id}-active` || locked}
                            onClick={() => patchUser(user.id, { isActive: !user.isActive })}
                          >
                            {user.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? (
          <CardContent className="py-12 text-center text-muted">No users yet.</CardContent>
        ) : null}
      </Card>
    </div>
  );
}
