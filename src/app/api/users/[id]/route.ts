import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { userPatchSchema } from "@/lib/validators";
import { issuePasswordSetup } from "@/lib/password-reset";
import { setLinkedUserActive } from "@/lib/portal-provision";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      email: true,
      firstName: true,
      role: true,
      isActive: true,
    },
  });
  if (!existing || !existing.schoolId || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = userPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  if (parsed.data.isActive === false && existing.id === session.userId) {
    return NextResponse.json({ message: "You cannot deactivate your own account" }, { status: 400 });
  }
  if (existing.role === UserRole.SUPER_ADMIN && parsed.data.isActive === false) {
    return NextResponse.json({ message: "Super admin accounts cannot be deactivated here" }, { status: 400 });
  }

  if (typeof parsed.data.isActive === "boolean") {
    await setLinkedUserActive({
      userId: existing.id,
      schoolId: existing.schoolId,
      actorId: session.userId,
      isActive: parsed.data.isActive,
    });
  }

  let invitesSent = 0;
  if (parsed.data.resendInvite) {
    const user = await prisma.user.findFirst({
      where: { id: existing.id, schoolId: existing.schoolId, isActive: true },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) {
      return NextResponse.json({ message: "Reactivate the user before resending an invite" }, { status: 400 });
    }
    await issuePasswordSetup({
      userId: user.id,
      schoolId: existing.schoolId,
      email: user.email,
      firstName: user.firstName,
      kind: "reset",
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
      createdAt: true,
    },
  });

  return NextResponse.json({ user, invitesSent });
}
