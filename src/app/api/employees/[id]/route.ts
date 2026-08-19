import { NextRequest, NextResponse } from "next/server";
import { StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
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
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...parsed.data,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : parsed.data.endDate,
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
  const { bankAccountEnc, ...safe } = employee;
  void bankAccountEnc;
  return NextResponse.json({ employee: safe });
}
