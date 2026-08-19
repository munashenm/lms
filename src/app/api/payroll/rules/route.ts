import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { EMPTY_PAYROLL_RULES, parsePayrollRules, type PayrollRules } from "@/lib/payroll-engine";
import { asInputJson } from "@/lib/json";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const percent = z.coerce.number().min(0).max(100);

const schema = z.object({
  name: z.string().min(1),
  jurisdiction: z.string().default("ZA"),
  effectiveFrom: z.string().min(1),
  employeeTaxPercent: percent.optional(),
  uifEmployeePercent: percent.optional(),
  uifEmployerPercent: percent.optional(),
  pensionEmployeePercent: percent.optional(),
  pensionEmployerPercent: percent.optional(),
  medicalEmployeePercent: percent.optional(),
  sdlEmployerPercent: percent.optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const rules = await prisma.payrollRuleSet.findMany({
    where: getSchoolFilter(session!),
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json({
    ruleSets: rules.map((row) => ({
      ...row,
      rules: parsePayrollRules(row.rulesJson),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "payroll.prepare")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const effectiveFrom = new Date(parsed.data.effectiveFrom);
  const rules: PayrollRules = {
    ...EMPTY_PAYROLL_RULES,
    jurisdiction: parsed.data.jurisdiction,
    employeeTaxPercent: parsed.data.employeeTaxPercent ?? 0,
    uifEmployeePercent: parsed.data.uifEmployeePercent ?? 0,
    uifEmployerPercent: parsed.data.uifEmployerPercent ?? 0,
    pensionEmployeePercent: parsed.data.pensionEmployeePercent ?? 0,
    pensionEmployerPercent: parsed.data.pensionEmployerPercent ?? 0,
    medicalEmployeePercent: parsed.data.medicalEmployeePercent ?? 0,
    sdlEmployerPercent: parsed.data.sdlEmployerPercent ?? 0,
  };
  await prisma.payrollRuleSet.updateMany({
    where: { schoolId, isActive: true },
    data: { isActive: false, effectiveTo: effectiveFrom },
  });
  const row = await prisma.payrollRuleSet.create({
    data: {
      schoolId,
      name: parsed.data.name,
      jurisdiction: parsed.data.jurisdiction,
      effectiveFrom,
      rulesJson: asInputJson(rules),
      isActive: true,
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "PAYROLL_RULES_UPDATED",
    entity: "PayrollRuleSet",
    entityId: row.id,
    metadata: { name: row.name, jurisdiction: row.jurisdiction },
  });
  return NextResponse.json({ ruleSet: { ...row, rules } }, { status: 201 });
}
