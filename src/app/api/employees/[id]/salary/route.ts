import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { asInputJson } from "@/lib/json";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  payType: z.enum(["MONTHLY", "HOURLY"]).default("MONTHLY"),
  baseSalary: z.coerce.number().min(0),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  effectiveFrom: z.string().min(1),
  allowances: z.array(z.object({ name: z.string(), amount: z.coerce.number() })).optional(),
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
  await prisma.salaryStructure.updateMany({
    where: { employeeId: id, effectiveTo: null },
    data: { effectiveTo: new Date(parsed.data.effectiveFrom) },
  });
  const row = await prisma.salaryStructure.create({
    data: {
      employeeId: id,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      payType: parsed.data.payType,
      baseSalary: parsed.data.baseSalary,
      hourlyRate: parsed.data.hourlyRate ?? null,
      allowancesJson: parsed.data.allowances ? asInputJson(parsed.data.allowances) : undefined,
    },
  });
  await logAudit({
    schoolId: employee.schoolId,
    userId: session!.userId,
    action: "SALARY_CHANGED",
    entity: "SalaryStructure",
    entityId: row.id,
    metadata: { employeeId: id, payType: parsed.data.payType },
  });
  return NextResponse.json({ salaryStructure: row }, { status: 201 });
}
