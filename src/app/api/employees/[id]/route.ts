import { NextRequest, NextResponse } from "next/server";
import { StaffStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { syncEmployeeEmploymentStatus } from "@/lib/employee-sync";
import {
  canAssignStaffPortalRole,
  defaultStaffPortalRole,
  isOfficerPortalRole,
  isStaffPortalRole,
  provisionStaffAccount,
} from "@/lib/portal-provision";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  department: z.string().optional(),
  position: z.string().optional(),
  status: z.nativeEnum(StaffStatus).optional(),
  endDate: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  invitePortal: z.boolean().optional(),
  portalRole: z.nativeEnum(UserRole).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      contracts: true,
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
      documents: true,
      leaveEntitlements: { include: { leavePolicy: true } },
      campus: true,
    },
  });
  if (!employee || !canAccessSchool(session, employee.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const own = employee.userId === session.userId;
  if (!own && !requirePermission(session, "hr.view") && !requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { bankAccountEnc, ...safe } = employee;
  void bankAccountEnc;
  return NextResponse.json({ employee: { ...safe } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "hr.employees.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session!, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(existing.schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const { invitePortal, portalRole, ...updates } = parsed.data;
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...updates,
      endDate: updates.endDate ? new Date(updates.endDate) : updates.endDate,
    },
  });
  if (parsed.data.status === "TERMINATED") {
    await logAudit({
      schoolId: existing.schoolId,
      userId: session!.userId,
      action: "EMPLOYEE_TERMINATED",
      entity: "Employee",
      entityId: id,
    });
  }
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await syncEmployeeEmploymentStatus({
      employeeId: id,
      schoolId: existing.schoolId,
      actorId: session!.userId,
      status: parsed.data.status,
    });
  }
  let provision: { created: boolean; linked: boolean; invitesSent: number; skipped: boolean } | null = null;
  if (invitePortal) {
    const requested = portalRole && isStaffPortalRole(portalRole) ? portalRole : null;
    let role =
      requested ?? defaultStaffPortalRole({ category: employee.category, teacherId: employee.teacherId });
    if (!canAssignStaffPortalRole(session!.role, role)) {
      role = defaultStaffPortalRole({ category: employee.category, teacherId: employee.teacherId });
    }
    if (isOfficerPortalRole(role) && !employee.userId) {
      const adminGuard = await licenseWriteGuard({
        schoolId: existing.schoolId,
        action: "create_administrator",
      });
      if (!adminGuard.ok) return licenseDeniedResponse(adminGuard);
    }
    try {
      provision = await provisionStaffAccount({
        schoolId: existing.schoolId,
        actorId: session!.userId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        role,
        employeeId: employee.id,
        teacherId: employee.teacherId,
        resend: true,
        source: "employee",
      });
    } catch {
      provision = { created: false, linked: false, invitesSent: 0, skipped: true };
    }
  }
  const { bankAccountEnc, ...safe } = employee;
  void bankAccountEnc;
  return NextResponse.json({ employee: safe, provision });
}
