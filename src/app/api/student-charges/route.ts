import { NextRequest, NextResponse } from "next/server";
import { FeeChargeSource, BillingFrequency, InstalmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createManualStudentCharge } from "@/lib/fee-engine";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z
  .object({
    studentId: z.string().min(1),
    description: z.string().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    source: z.nativeEnum(FeeChargeSource).default(FeeChargeSource.MANUAL_CHARGE),
    feeStructureId: z.string().optional().nullable(),
    academicYearId: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    allowInstalments: z.boolean().optional(),
    instalmentCount: z.coerce.number().int().positive().optional().nullable(),
    frequency: z.nativeEnum(BillingFrequency).optional(),
  })
  .refine((data) => Boolean(data.feeStructureId) || (data.description && data.amount), {
    message: "Provide a fee structure or a description and amount",
  });

function customScheduleOf(value: unknown) {
  return Array.isArray(value)
    ? (value as Array<{ dueDate?: string; amount?: number; dueOffsetDays?: number }>)
    : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const studentId = request.nextUrl.searchParams.get("studentId");
  const outstanding = request.nextUrl.searchParams.get("outstanding") === "1";
  const charges = await prisma.studentCharge.findMany({
    where: {
      ...getSchoolFilter(session!),
      reversedAt: null,
      ...(studentId ? { studentId } : {}),
      ...(outstanding
        ? { instalments: { some: { status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] } } } }
        : {}),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      instalments: { orderBy: { sequence: "asc" } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ charges });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.fees.manage") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const student = await prisma.student.findFirst({ where: { id: parsed.data.studentId, schoolId } });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  let description = parsed.data.description;
  let amount = parsed.data.amount;
  let source = parsed.data.source;
  let frequency = parsed.data.frequency;
  let allowInstalments = parsed.data.allowInstalments;
  let instalmentCount = parsed.data.instalmentCount;
  let academicYearId = parsed.data.academicYearId;
  let customSchedule: Array<{ dueDate?: string; amount?: number; dueOffsetDays?: number }> | null = null;
  let dueDayOfMonth: number | null = null;

  if (parsed.data.feeStructureId) {
    const fee = await prisma.feeStructure.findFirst({
      where: { id: parsed.data.feeStructureId, schoolId },
    });
    if (!fee) return NextResponse.json({ message: "Fee structure not found" }, { status: 404 });
    description = description || fee.name;
    amount = amount ?? Number(fee.amount);
    source = fee.chargeSource;
    frequency = frequency ?? fee.billingFrequency;
    allowInstalments = allowInstalments ?? fee.allowInstalments;
    instalmentCount = instalmentCount ?? fee.instalmentCount;
    academicYearId = academicYearId || fee.academicYearId;
    customSchedule = customScheduleOf(fee.customScheduleJson);
    dueDayOfMonth = fee.dueDayOfMonth;
  }

  if (!academicYearId) {
    const current = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    academicYearId = current?.id ?? null;
  }

  if (!description || amount == null) {
    return NextResponse.json({ message: "Description and amount are required" }, { status: 400 });
  }

  const result = await createManualStudentCharge({
    schoolId,
    studentId: student.id,
    academicYearId,
    feeStructureId: parsed.data.feeStructureId,
    source,
    description,
    amount,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    allowInstalments,
    instalmentCount,
    frequency,
    customSchedule,
    dueDayOfMonth,
    recordedById: session!.userId,
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "STUDENT_CHARGE_CREATED",
    entity: "StudentCharge",
    entityId: result.charge.id,
    metadata: { amount, source, skipped: result.skipped, feeStructureId: parsed.data.feeStructureId },
  });
  return NextResponse.json(result, { status: result.skipped ? 200 : 201 });
}
