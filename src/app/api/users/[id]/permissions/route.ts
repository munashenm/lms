import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, rolePermissionSet } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { userPermissionsSchema } from "@/lib/validators";
import {
  ACTION_PERMISSIONS,
  defaultActionPermissionsForRole,
  isActionPermission,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "users.permissions");
  if (denied) return denied;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      schoolId: true,
      permissionGrants: true,
      permissionDenies: true,
      isActive: true,
    },
  });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (user.schoolId && !canAccessSchool(session!, user.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (!user.schoolId && session!.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const roleDefaults = defaultActionPermissionsForRole(user.role, rolePermissionSet(user.role));
  const grants = new Set(user.permissionGrants.filter(isActionPermission));
  const denies = new Set(user.permissionDenies.filter(isActionPermission));
  const effective = ACTION_PERMISSIONS.filter((permission) => {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (denies.has(permission)) return false;
    if (grants.has(permission)) return true;
    return roleDefaults.includes(permission);
  });

  return NextResponse.json({
    user,
    groups: PERMISSION_GROUPS.map((group) => ({
      ...group,
      items: group.permissions.map((permission) => ({
        key: permission,
        label: PERMISSION_LABELS[permission],
      })),
    })),
    roleDefaults,
    grants: [...grants],
    denies: [...denies],
    effective,
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "users.permissions");
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      schoolId: true,
      permissionGrants: true,
      permissionDenies: true,
    },
  });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (existing.schoolId && !canAccessSchool(session!, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (!existing.schoolId && session!.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = userPermissionsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const grants = parsed.data.grants.filter(isActionPermission);
  const denies = parsed.data.denies.filter(isActionPermission);
  await prisma.user.update({
    where: { id: existing.id },
    data: { permissionGrants: grants, permissionDenies: denies },
  });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "PERMISSIONS_UPDATE",
    entity: "User",
    entityId: existing.id,
    metadata: {
      affectedUser: existing.email,
      old: { grants: existing.permissionGrants, denies: existing.permissionDenies },
      new: { grants, denies },
    },
    ...requestMeta(request),
  });

  return NextResponse.json({ ok: true, grants, denies });
}
