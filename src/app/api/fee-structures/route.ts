import { NextRequest, NextResponse } from "next/server";
import { BillingFrequency, FeeChargeSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  chargeSource: z.nativeEnum(FeeChargeSource),
  amount: z.coerce.number().positive(),
  billingFrequency: z.nativeEnum(BillingFrequency).default(BillingFrequency.ONCE),
  allowInstalments: z.boolean().optional(),
  instalmentCount: z.coerce.number().int().positive().optional().nullable(),
  customScheduleJson: z.unknown().optional(),
  academicYearId: z.string().optional().nullable(),
  termId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  gradeId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(),
  moduleId: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(28).optional().nullable(),
  applyOnEnrolment: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function canManage(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return requirePermission(session, "finance.fees.manage") || requirePermission(session, "finance:write");
}

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const items = await prisma.feeStructure.findMany({
    where: getSchoolFilter(session!),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ feeStructures: items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canManage(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }
  const item = await prisma.feeStructure.create({
    data: {
      schoolId,
      ...parsed.data,
      amount: parsed.data.amount,
      customScheduleJson: parsed.data.customScheduleJson ?? undefined,
    },
  });
  await logAudit({
    schoolId,
    userId: session.userId,
    action: "FEE_CREATED",
    entity: "FeeStructure",
    entityId: item.id,
    metadata: { name: item.name, amount: parsed.data.amount, source: item.chargeSource },
  });
  return NextResponse.json({ feeStructure: item }, { status: 201 });
}
