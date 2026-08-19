import { NextRequest, NextResponse } from "next/server";
import { StaffStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { teacherPatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { emptyToNull } from "@/lib/class-teachers";
import { syncEmployeeEmploymentStatus } from "@/lib/employee-sync";
import { provisionStaffAccount, setLinkedUserActive } from "@/lib/portal-provision";
import { staffPortalShouldBeActive } from "@/lib/portal-lifecycle";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "staff:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const parsed = teacherPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  const teacher = await prisma.teacher.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.email !== undefined ? { email: emptyToNull(data.email) } : {}),
      ...(data.phone !== undefined ? { phone: emptyToNull(data.phone) } : {}),
      ...(data.department !== undefined ? { department: emptyToNull(data.department) } : {}),
      ...(data.campusId !== undefined ? { campusId: emptyToNull(data.campusId) } : {}),
      ...(data.status !== undefined ? { status: data.status as StaffStatus } : {}),
    },
  });

  const employee = await prisma.employee.findUnique({
    where: { teacherId: id },
    select: { id: true, userId: true },
  });
  if (employee) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(data.email !== undefined ? { email: teacher.email } : {}),
        ...(data.phone !== undefined ? { phone: teacher.phone } : {}),
        ...(data.department !== undefined ? { department: teacher.department } : {}),
        ...(data.campusId !== undefined ? { campusId: teacher.campusId } : {}),
        ...(data.firstName !== undefined ? { firstName: teacher.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: teacher.lastName } : {}),
        ...(data.status !== undefined ? { status: teacher.status } : {}),
      },
    });
  }

  if (data.status && data.status !== existing.status) {
    if (employee) {
      await syncEmployeeEmploymentStatus({
        employeeId: employee.id,
        schoolId: existing.schoolId,
        actorId: session.userId,
        status: data.status as StaffStatus,
      });
    } else {
      await setLinkedUserActive({
        userId: teacher.userId,
        schoolId: existing.schoolId,
        actorId: session.userId,
        isActive: staffPortalShouldBeActive(data.status),
      });
    }
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Teacher",
      entityId: id,
      metadata: { status: data.status },
    });
  }

  let provision: { created: boolean; linked: boolean; invitesSent: number; skipped: boolean } | null = null;
  if (data.invitePortal) {
    try {
      provision = await provisionStaffAccount({
        schoolId: existing.schoolId,
        actorId: session.userId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.phone,
        role: UserRole.TEACHER,
        employeeId: employee?.id,
        teacherId: teacher.id,
        resend: true,
        source: "teacher",
      });
    } catch {
      provision = { created: false, linked: false, invitesSent: 0, skipped: true };
    }
  }

  return NextResponse.json({ teacher, provision });
}
