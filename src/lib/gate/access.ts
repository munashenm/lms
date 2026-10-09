import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, type Permission } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";

export function canUseSecurityPortal(role: UserRole): boolean {
  return (
    role === UserRole.SECURITY ||
    role === UserRole.SCHOOL_ADMIN ||
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.PRINCIPAL
  );
}

export async function requireSchoolPermission(permission: Permission): Promise<
  { session: SessionPayload; schoolId: string } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, permission)) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 403 }) };
  }
  return { session, schoolId: session.schoolId };
}
