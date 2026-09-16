import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission, requirePermission } from "@/lib/rbac";
import { directoryRolesForActor } from "@/lib/portal-provision";
import { UsersDirectory } from "@/components/admin/users-directory";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!requirePermission(session, "users.view")) {
    return <AccessDenied />;
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
        student: { select: { studentNumber: true } },
        teacher: { select: { employeeNumber: true } },
        employee: { select: { employeeNumber: true } },
        guardian: {
          select: {
            students: {
              select: {
                student: { select: { firstName: true, lastName: true, studentNumber: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.school.findMany({
      where: { isActive: true, ...("schoolId" in filter ? { id: filter.schoolId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canWrite = hasPermission(session.role, "users.edit");
  const showSchoolColumn = !("schoolId" in filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted text-sm mt-1">
          Staff, students and parents are listed separately. Search students by name or student ID,
          and staff by name or employee ID.
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
          studentNumber: u.student?.studentNumber ?? null,
          employeeNumber: u.employee?.employeeNumber ?? u.teacher?.employeeNumber ?? null,
          linkedStudents: (u.guardian?.students ?? []).map((link) => ({
            name: `${link.student.firstName} ${link.student.lastName}`,
            studentNumber: link.student.studentNumber,
          })),
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
