import { NextRequest, NextResponse } from "next/server";
import { EmployeeCategory, EmploymentType, StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/secret-crypto";
import { nextHrEmployeeNumber } from "@/lib/employee-sync";
import { z } from "zod";

function stripBank<T extends { bankAccountEnc?: string | null }>(row: T) {
  const copy = { ...row };
  delete copy.bankAccountEnc;
  return copy;
}

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  category: z.nativeEnum(EmployeeCategory).optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  campusId: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  startDate: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  branchCode: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  baseSalary: z.coerce.number().min(0).optional(),
  payType: z.enum(["MONTHLY", "HOURLY"]).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view") && !requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const employees = await prisma.employee.findMany({
    where: getSchoolFilter(session!),
    include: { campus: { select: { name: true } }, salaryStructures: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    orderBy: { lastName: "asc" },
  });
  return NextResponse.json({ employees: employees.map(stripBank) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "hr.employees.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  const employeeNumber = parsed.data.employeeNumber?.trim() || (await nextHrEmployeeNumber(schoolId));
  const last4 = parsed.data.bankAccountNumber ? parsed.data.bankAccountNumber.slice(-4) : null;
  const employee = await prisma.employee.create({
    data: {
      schoolId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      employeeNumber,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      category: parsed.data.category ?? EmployeeCategory.OTHER,
      department: parsed.data.department || null,
      position: parsed.data.position || null,
      campusId: parsed.data.campusId ?? null,
      employmentType: parsed.data.employmentType ?? EmploymentType.PERMANENT,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      userId: parsed.data.userId ?? null,
      teacherId: parsed.data.teacherId ?? null,
      bankName: parsed.data.bankName || null,
      bankAccountName: parsed.data.bankAccountName || null,
      bankAccountLast4: last4,
      bankAccountEnc: parsed.data.bankAccountNumber ? encryptSecret(parsed.data.bankAccountNumber) : null,
      branchCode: parsed.data.branchCode || null,
      emergencyName: parsed.data.emergencyName || null,
      emergencyPhone: parsed.data.emergencyPhone || null,
      status: StaffStatus.ACTIVE,
    },
  });
  if (parsed.data.baseSalary != null || parsed.data.hourlyRate != null) {
    await prisma.salaryStructure.create({
      data: {
        employeeId: employee.id,
        effectiveFrom: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
        payType: parsed.data.payType ?? "MONTHLY",
        baseSalary: parsed.data.baseSalary ?? 0,
        hourlyRate: parsed.data.hourlyRate ?? null,
      },
    });
  }
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "EMPLOYEE_CREATED",
    entity: "Employee",
    entityId: employee.id,
    metadata: { employeeNumber, category: employee.category },
  });
  return NextResponse.json({ employee: stripBank(employee) }, { status: 201 });
}
