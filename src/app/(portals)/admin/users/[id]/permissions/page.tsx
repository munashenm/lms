import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission, rolePermissionSet } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AccessDenied } from "@/components/layout/access-denied";
import { UserPermissionsForm } from "@/components/admin/user-permissions-form";
import { ROLE_LABELS } from "@/lib/constants";
import {
  defaultActionPermissionsForRole,
  isActionPermission,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type ActionPermission,
} from "@/lib/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPermissionsPage({ params }: PageProps) {
  const session = await getSession();
  if (!requirePermission(session, "users.permissions")) return <AccessDenied />;
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      schoolId: true,
      permissionGrants: true,
      permissionDenies: true,
    },
  });
  if (!user) notFound();
  if (user.schoolId && !canAccessSchool(session, user.schoolId)) notFound();
  if (!user.schoolId && session.role !== UserRole.SUPER_ADMIN) notFound();

  const roleDefaults = defaultActionPermissionsForRole(user.role, rolePermissionSet(user.role));
  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: group.permissions.map((permission) => ({
      key: permission,
      label: PERMISSION_LABELS[permission],
    })),
  }));

  return (
    <UserPermissionsForm
      userId={user.id}
      userName={`${user.firstName} ${user.lastName}`}
      roleLabel={ROLE_LABELS[user.role]}
      groups={groups}
      roleDefaults={roleDefaults}
      initialGrants={user.permissionGrants.filter(isActionPermission) as ActionPermission[]}
      initialDenies={user.permissionDenies.filter(isActionPermission) as ActionPermission[]}
    />
  );
}
