import { cache } from "react";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { forbiddenJson } from "@/lib/http";
import { navHrefModule, permissionModule, type SystemModuleKey } from "@/lib/modules";
import { requirePermission, type Permission } from "@/lib/rbac";
import type { NavItem } from "@/lib/navigation";

export const getSchoolModuleMap = cache(async (schoolId: string | null | undefined) => {
  const map = new Map<string, boolean>();
  if (!schoolId) return map;
  try {
    const rows = await prisma.schoolModule.findMany({
      where: { schoolId },
      select: { moduleKey: true, enabled: true },
    });
    for (const row of rows) map.set(row.moduleKey, row.enabled);
  } catch {
    return map;
  }
  return map;
});

export function isModuleEnabled(map: Map<string, boolean>, moduleKey: SystemModuleKey): boolean {
  if (!map.has(moduleKey)) return true;
  return map.get(moduleKey) !== false;
}

export async function schoolModuleEnabled(schoolId: string | null | undefined, moduleKey: SystemModuleKey) {
  if (!schoolId) return true;
  const map = await getSchoolModuleMap(schoolId);
  return isModuleEnabled(map, moduleKey);
}

export async function sessionCan(
  session: SessionPayload | null,
  permission: Permission,
  schoolId?: string | null
): Promise<boolean> {
  if (!requirePermission(session, permission)) return false;
  if (!session || session.role === UserRole.SUPER_ADMIN) return true;
  const moduleKey = permissionModule(permission);
  if (!moduleKey) return true;
  const id = schoolId ?? session.schoolId;
  return schoolModuleEnabled(id, moduleKey);
}

export async function denyUnless(
  session: SessionPayload | null,
  permission: Permission,
  schoolId?: string | null
) {
  if (await sessionCan(session, permission, schoolId)) return null;
  return forbiddenJson();
}

export async function filterNavByModules(
  items: NavItem[],
  session: SessionPayload,
  schoolId?: string | null
): Promise<NavItem[]> {
  if (session.role === UserRole.SUPER_ADMIN) return items;
  const map = await getSchoolModuleMap(schoolId ?? session.schoolId);
  return items.filter((item) => {
    const moduleKey = navHrefModule(item.href);
    if (!moduleKey) return true;
    return isModuleEnabled(map, moduleKey);
  });
}
