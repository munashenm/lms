import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission, requirePermission } from "@/lib/rbac";
import { directoryRolesForActor } from "@/lib/portal-provision";
import { UsersDirectory } from "@/components/admin/users-directory";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    notFound();
  }

  const filter = getSchoolFilter(session);
  const [users, schools] = await Promise.all([
    prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        school: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.school.findMany({
      where: { isActive: true, ...("schoolId" in filter ? { id: filter.schoolId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canWrite = hasPermission(session.role, "settings:write");
  const showSchoolColumn = !("schoolId" in filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted text-sm mt-1">
          Invite school admins, officers, and staff logins. Teachers stay on the Staff page.
        </p>
      </div>
      <UsersDirectory
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt,
          schoolName: u.school?.name ?? null,
        }))}
        currentUserId={session.userId}
        canWrite={canWrite}
        inviteRoles={directoryRolesForActor(session.role)}
        schools={schools}
        showSchoolColumn={showSchoolColumn}
      />
    </div>
  );
}
