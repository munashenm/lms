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

const schema = z.object({
  studentId: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  source: z.nativeEnum(FeeChargeSource).default(FeeChargeSource.MANUAL_CHARGE),
  feeStructureId: z.string().optional().nullable(),
  academicYearId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  allowInstalments: z.boolean().optional(),
  instalmentCount: z.coerce.number().int().positive().optional().nullable(),
  frequency: z.nativeEnum(BillingFrequency).optional(),
});

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

  const result = await createManualStudentCharge({
    schoolId,
    studentId: student.id,
    academicYearId: parsed.data.academicYearId,
    feeStructureId: parsed.data.feeStructureId,
    source: parsed.data.source,
    description: parsed.data.description,
    amount: parsed.data.amount,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    allowInstalments: parsed.data.allowInstalments,
    instalmentCount: parsed.data.instalmentCount,
    frequency: parsed.data.frequency,
    recordedById: session!.userId,
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "STUDENT_CHARGE_CREATED",
    entity: "StudentCharge",
    entityId: result.charge.id,
    metadata: { amount: parsed.data.amount, source: parsed.data.source, skipped: result.skipped },
  });
  return NextResponse.json(result, { status: result.skipped ? 200 : 201 });
}
