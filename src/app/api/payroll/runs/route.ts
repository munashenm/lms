import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { calculatePayrollRun } from "@/lib/payroll-run";
import { EMPTY_PAYROLL_RULES } from "@/lib/payroll-engine";
import { asInputJson } from "@/lib/json";
import { z } from "zod";

const schema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  paymentDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const runs = await prisma.payrollRun.findMany({
    where: getSchoolFilter(session!),
    orderBy: { periodStart: "desc" },
    take: 50,
  });
  return NextResponse.json({ runs });
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
  let ruleSet = await prisma.payrollRuleSet.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!ruleSet) {
    ruleSet = await prisma.payrollRuleSet.create({
      data: {
        schoolId,
        name: "Default (no statutory tables)",
        jurisdiction: "ZA",
        effectiveFrom: new Date("2000-01-01"),
        rulesJson: asInputJson(EMPTY_PAYROLL_RULES),
      },
    });
  }
  const run = await prisma.payrollRun.create({
    data: {
      schoolId,
      ruleSetId: ruleSet.id,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : null,
      notes: parsed.data.notes,
      createdById: session!.userId,
    },
  });
  const calculated = await calculatePayrollRun({
    runId: run.id,
    schoolId,
    actorId: session!.userId,
  });
  return NextResponse.json({ run: calculated }, { status: 201 });
}
