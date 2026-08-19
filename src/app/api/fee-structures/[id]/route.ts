import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { BillingFrequency, FeeChargeSource } from "@prisma/client";

const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  chargeSource: z.nativeEnum(FeeChargeSource).optional(),
  amount: z.coerce.number().positive().optional(),
  billingFrequency: z.nativeEnum(BillingFrequency).optional(),
  allowInstalments: z.boolean().optional(),
  instalmentCount: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  applyOnEnrolment: z.boolean().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || (!requirePermission(session, "finance.fees.manage") && !requirePermission(session, "finance:write"))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.feeStructure.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(existing.schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const item = await prisma.feeStructure.update({ where: { id }, data: parsed.data });
  await logAudit({
    schoolId: existing.schoolId,
    userId: session.userId,
    action: "FEE_CHANGED",
    entity: "FeeStructure",
    entityId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ feeStructure: item });
}
