import { NextRequest, NextResponse } from "next/server";
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
  title: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "hr.employees.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || !canAccessSchool(session!, employee.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(employee.schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const contract = await prisma.employmentContract.create({
    data: {
      employeeId: id,
      title: parsed.data.title,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      notes: parsed.data.notes ?? null,
      documentUrl: parsed.data.documentUrl ?? null,
    },
  });
  await logAudit({
    schoolId: employee.schoolId,
    userId: session!.userId,
    action: "EMPLOYMENT_CONTRACT_CREATED",
    entity: "EmploymentContract",
    entityId: contract.id,
    metadata: { employeeId: id, title: contract.title },
  });
  return NextResponse.json({ contract }, { status: 201 });
}
