import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scopedId } from "@/lib/tenant";
import { requireStaffPermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { BillingFrequency, FeeChargeSource } from "@prisma/client";
import { feeStructureRuleError, normalizeYearlyDiscount, structuredAllowInstalments } from "@/lib/fee-pricing";

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
  priceIsPerPeriod: z.boolean().optional(),
  invoiceYearly: z.boolean().optional(),
  yearlyDiscountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || (!requireStaffPermission(session, "finance.fees.manage") && !requireStaffPermission(session, "finance:write"))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.feeStructure.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(existing.schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const discount =
    parsed.data.yearlyDiscountPercent !== undefined
      ? normalizeYearlyDiscount(parsed.data.yearlyDiscountPercent)
      : existing.yearlyDiscountPercent == null
        ? null
        : Number(existing.yearlyDiscountPercent);
  if (discount === "invalid") {
    return NextResponse.json({ message: "Yearly discount must be between 0 and 100." }, { status: 400 });
  }
  const rule = {
    chargeSource: parsed.data.chargeSource ?? existing.chargeSource,
    billingFrequency: parsed.data.billingFrequency ?? existing.billingFrequency,
    priceIsPerPeriod: parsed.data.priceIsPerPeriod ?? existing.priceIsPerPeriod,
    invoiceYearly: parsed.data.invoiceYearly ?? existing.invoiceYearly,
    yearlyDiscountPercent: discount,
    allowInstalments: parsed.data.allowInstalments ?? existing.allowInstalments,
    gradeId: existing.gradeId,
    courseId: existing.courseId,
    moduleId: existing.moduleId,
  };
  const ruleError = feeStructureRuleError(rule);
  if (ruleError) return NextResponse.json({ message: ruleError }, { status: 400 });
  const item = await prisma.feeStructure.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.yearlyDiscountPercent !== undefined ? { yearlyDiscountPercent: discount } : {}),
      allowInstalments: structuredAllowInstalments(rule, rule.allowInstalments),
    },
  });
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
