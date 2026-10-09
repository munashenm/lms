"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import {
  DIRECTORY_GROUPS,
  DIRECTORY_GROUP_LABELS,
  filterDirectoryUsers,
  groupDirectoryUsers,
  type DirectoryGroup,
  type DirectoryUserRecord,
} from "@/lib/user-directory";

const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  SECURITY: "Security",
  FINANCE_OFFICER: "Finance officer",
  HR_OFFICER: "HR officer",
  ADMISSIONS_OFFICER: "Admissions officer",
  PRINCIPAL: "Principal",
  SCHOOL_ADMIN: "School admin",
  SUPER_ADMIN: "Super admin",
  TEACHER: "Educator",
  STUDENT: "Learner",
  PARENT: "Parent",
};

interface SchoolOption {
  id: string;
  name: string;
}

const SEARCH_PLACEHOLDERS: Record<DirectoryGroup, string> = {
  staff: "Search staff by name or employee ID",
  students: "Search students by name or student ID",
  parents: "Search parents by name or linked student ID",
};

export function UsersDirectory({
  users,
  currentUserId,
  actorRole,
  canWrite,
  inviteRoles,
  schools,
  showSchoolColumn,
}: {
  users: DirectoryUserRecord[];
  currentUserId: string;
  actorRole: string;
  canWrite: boolean;
  inviteRoles: string[];
  schools: SchoolOption[];
  showSchoolColumn: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [group, setGroup] = useState<DirectoryGroup>("staff");
  const [queries, setQueries] = useState<Record<DirectoryGroup, string>>({
    staff: "",
    students: "",
    parents: "",
  });
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirm: "",
    requirePasswordChange: false,
  });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: inviteRoles[0] ?? "STAFF",
    schoolId: schools[0]?.id ?? "",
  });

  const grouped = useMemo(() => groupDirectoryUsers(users), [users]);
  const visible = useMemo(
    () => filterDirectoryUsers(users, group, queries[group]),
    [users, group, queries]
  );

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
      toast.success("User invited. Welcome email sent with login details.");
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

  const actorCanSetPasswords = actorRole === "SUPER_ADMIN" || actorRole === "SCHOOL_ADMIN";

  function canSetPasswordFor(user: DirectoryUserRecord) {
    if (!actorCanSetPasswords) return false;
    if (actorRole === "SCHOOL_ADMIN" && user.role === "SUPER_ADMIN") return false;
    return true;
  }

  async function setPassword(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (passwordForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(`${id}-password`);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordForm.password,
          requirePasswordChange: passwordForm.requirePasswordChange,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not set password");
        return;
      }
      toast.success(
        passwordForm.requirePasswordChange
          ? "Password updated. They must choose a new password the next time they sign in."
          : "Password updated. Existing sessions for that user are signed out."
      );
      setPasswordFor(null);
      setPasswordForm({ password: "", confirm: "", requirePasswordChange: false });
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
      if (body.resendInvite) toast.success("Welcome email sent with login details.");
      else toast.success(body.isActive ? "User reactivated" : "User deactivated");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function identifier(user: DirectoryUserRecord) {
    if (group === "students") return user.studentNumber || "—";
    if (group === "staff") return user.employeeNumber || "—";
    if (user.linkedStudents.length === 0) return "—";
    return user.linkedStudents
      .map((student) => `${student.name} (${student.studentNumber})`)
      .join(", ");
  }

  const identifierLabel =
    group === "students" ? "Student ID" : group === "staff" ? "Employee ID" : "Linked students";

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

      <div className="flex flex-wrap gap-2">
        {DIRECTORY_GROUPS.map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium border",
              group === key
                ? "bg-primary text-white border-primary"
                : "bg-surface border-border text-muted hover:bg-background"
            )}
            onClick={() => setGroup(key)}
          >
            {DIRECTORY_GROUP_LABELS[key]} ({grouped[key].length})
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">{DIRECTORY_GROUP_LABELS[group]}</CardTitle>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={queries[group]}
              onChange={(e) => setQueries({ ...queries, [group]: e.target.value })}
              placeholder={SEARCH_PLACEHOLDERS[group]}
              aria-label={SEARCH_PLACEHOLDERS[group]}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">{identifierLabel}</th>
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
              {visible.map((user) => {
                const isSelf = user.id === currentUserId;
                const locked = user.role === "SUPER_ADMIN" || isSelf;
                return (
                  <Fragment key={user.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{identifier(user)}</td>
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
                          <Button type="button" size="sm" variant="outline" asChild>
                            <a href={`/admin/users/${user.id}/permissions`}>Permissions</a>
                          </Button>
                          {canSetPasswordFor(user) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={loading === `${user.id}-password` || !user.isActive}
                              onClick={() => {
                                setPasswordFor(passwordFor === user.id ? null : user.id);
                                setPasswordForm({ password: "", confirm: "", requirePasswordChange: false });
                              }}
                            >
                              Set password
                            </Button>
                          ) : null}
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
                  {passwordFor === user.id ? (
                    <tr className="border-b border-border bg-background/40">
                      <td colSpan={showSchoolColumn ? 7 : 6} className="px-4 py-3">
                        <form
                          onSubmit={(e) => setPassword(e, user.id)}
                          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end max-w-4xl"
                        >
                          <div>
                            <Label htmlFor={`password-${user.id}`}>New password</Label>
                            <Input
                              id={`password-${user.id}`}
                              type="password"
                              autoComplete="new-password"
                              required
                              minLength={8}
                              value={passwordForm.password}
                              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`confirm-${user.id}`}>Confirm password</Label>
                            <Input
                              id={`confirm-${user.id}`}
                              type="password"
                              autoComplete="new-password"
                              required
                              minLength={8}
                              value={passwordForm.confirm}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm md:pb-2">
                            <input
                              type="checkbox"
                              checked={passwordForm.requirePasswordChange}
                              onChange={(e) =>
                                setPasswordForm({ ...passwordForm, requirePasswordChange: e.target.checked })
                              }
                            />
                            Require a new password at next login
                          </label>
                          <Button type="submit" size="sm" disabled={loading === `${user.id}-password`}>
                            Save password
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 ? (
          <CardContent className="py-12 text-center text-muted">
            {grouped[group].length === 0
              ? `No ${DIRECTORY_GROUP_LABELS[group].toLowerCase()} yet.`
              : `No ${DIRECTORY_GROUP_LABELS[group].toLowerCase()} match that search.`}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
