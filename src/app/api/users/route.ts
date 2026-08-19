import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { userInviteSchema } from "@/lib/validators";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import {
  canAssignDirectoryRole,
  findOrCreatePortalUser,
  isDirectoryInviteRole,
  needsAdministratorLicense,
} from "@/lib/portal-provision";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: getSchoolFilter(session),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      school: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = userInviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const role = parsed.data.role as UserRole;
  if (!isDirectoryInviteRole(role) || !canAssignDirectoryRole(session.role, role)) {
    return NextResponse.json({ message: "You cannot assign this role" }, { status: 403 });
  }

  const schoolId =
    session.role === UserRole.SUPER_ADMIN && parsed.data.schoolId
      ? parsed.data.schoolId
      : await requireSchoolId(session);

  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;

  if (needsAdministratorLicense(role)) {
    const guard = await licenseWriteGuard({ schoolId, action: "create_administrator" });
    if (!guard.ok) return licenseDeniedResponse(guard);
  }

  const result = await findOrCreatePortalUser({
    schoolId,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone || null,
    role,
    actorId: session.userId,
    source: "admin-users",
  });

  if ("skipped" in result) {
    return NextResponse.json(
      { message: "That email is already in use for a different role or school" },
      { status: 409 }
    );
  }

  if (!result.created) {
    return NextResponse.json(
      { message: "A user with this email and role already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user, invitesSent: 1 }, { status: 201 });
}
