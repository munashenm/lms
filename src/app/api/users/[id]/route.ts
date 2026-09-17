import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { userPatchSchema } from "@/lib/validators";
import { issuePasswordSetup } from "@/lib/password-reset";
import { canAssignDirectoryRole, setLinkedUserActive } from "@/lib/portal-provision";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";
import { emptyToNull } from "@/lib/class-teachers";
import { forbiddenJson } from "@/lib/http";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "users.view");
  if (denied) return denied;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      mustResetPassword: true,
      permissionGrants: true,
      permissionDenies: true,
      schoolId: true,
      campusId: true,
      createdAt: true,
      school: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
  });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (user.schoolId && !canAccessSchool(session!, user.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (!user.schoolId && session!.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "users.edit");
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      campusId: true,
    },
  });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (existing.schoolId && !canAccessSchool(session!, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (!existing.schoolId && session!.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (existing.schoolId) {
    const licenseDenied = await requireLicenseWrite(existing.schoolId);
    if (licenseDenied) return licenseDenied;
  }

  const parsed = userPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  if (typeof parsed.data.isActive === "boolean") {
    const deniedDisable = await denyUnless(session, "users.disable");
    if (deniedDisable) return deniedDisable;
  }

  if (parsed.data.isActive === false && existing.id === session!.userId) {
    return NextResponse.json({ message: "You cannot deactivate your own account" }, { status: 400 });
  }
  if (existing.role === UserRole.SUPER_ADMIN && parsed.data.isActive === false) {
    return NextResponse.json({ message: "Super admin accounts cannot be deactivated here" }, { status: 400 });
  }
  if (parsed.data.role && parsed.data.role !== existing.role) {
    if (session!.role !== UserRole.SUPER_ADMIN && !canAssignDirectoryRole(session!.role, parsed.data.role)) {
      return forbiddenJson();
    }
    if (parsed.data.role === UserRole.SUPER_ADMIN && session!.role !== UserRole.SUPER_ADMIN) {
      return forbiddenJson();
    }
  }

  const schoolId = existing.schoolId ?? parsed.data.schoolId ?? session!.schoolId;
  if (typeof parsed.data.isActive === "boolean" && schoolId) {
    await setLinkedUserActive({
      userId: existing.id,
      schoolId,
      actorId: session!.userId,
      isActive: parsed.data.isActive,
    });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.firstName) data.firstName = parsed.data.firstName;
  if (parsed.data.lastName) data.lastName = parsed.data.lastName;
  if (parsed.data.email) data.email = parsed.data.email.toLowerCase();
  if (parsed.data.phone !== undefined) data.phone = emptyToNull(parsed.data.phone);
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.campusId !== undefined) data.campusId = emptyToNull(parsed.data.campusId);
  if (parsed.data.mustResetPassword !== undefined) data.mustResetPassword = parsed.data.mustResetPassword;
  if (parsed.data.isActive === false || parsed.data.mustResetPassword === true) {
    data.sessionVersion = { increment: 1 };
  }
  if (session!.role === UserRole.SUPER_ADMIN && parsed.data.schoolId !== undefined) {
    data.schoolId = emptyToNull(parsed.data.schoolId);
  }
  if (typeof parsed.data.isActive === "boolean" && !schoolId) {
    data.isActive = parsed.data.isActive;
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: existing.id }, data });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "User",
      entityId: existing.id,
      metadata: { fields: Object.keys(data), old: { role: existing.role, email: existing.email } },
      ...requestMeta(request),
    });
  }

  let invitesSent = 0;
  if (parsed.data.resendInvite || parsed.data.resetPassword) {
    const user = await prisma.user.findFirst({
      where: { id: existing.id, isActive: true },
      select: { id: true, email: true, firstName: true, schoolId: true },
    });
    if (!user) {
      return NextResponse.json({ message: "Reactivate the user before resending an invite" }, { status: 400 });
    }
    await issuePasswordSetup({
      userId: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      kind: "reset",
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { mustResetPassword: true, sessionVersion: { increment: 1 } },
    });
    invitesSent = 1;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      mustResetPassword: true,
      schoolId: true,
      campusId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user, invitesSent });
}
