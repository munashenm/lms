import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { approvePayrollRun, calculatePayrollRun, finalisePayrollRun, reversePayrollRun } from "@/lib/payroll-run";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const actionSchema = z.object({
  action: z.enum(["calculate", "approve", "finalise", "reverse"]),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      items: { include: { employee: true, payslip: true } },
      ruleSet: true,
    },
  });
  if (!run || !canAccessSchool(session!, run.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    run: {
      ...run,
      items: run.items.map((item) => ({
        ...item,
        employee: (() => {
          const { bankAccountEnc, ...safe } = item.employee as typeof item.employee & { bankAccountEnc?: string | null };
          void bankAccountEnc;
          return safe;
        })(),
      })),
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run || !canAccessSchool(session, run.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(run.schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  try {
    if (parsed.data.action === "calculate") {
      if (!requirePermission(session, "payroll.prepare")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      const updated = await calculatePayrollRun({ runId: id, schoolId: run.schoolId, actorId: session.userId });
      return NextResponse.json({ run: updated });
    }
    if (parsed.data.action === "approve") {
      if (!requirePermission(session, "payroll.approve")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      const updated = await approvePayrollRun({ runId: id, schoolId: run.schoolId, actorId: session.userId });
      return NextResponse.json({ run: updated });
    }
    if (parsed.data.action === "reverse") {
      if (!requirePermission(session, "payroll.finalise")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      }
      const updated = await reversePayrollRun({ runId: id, schoolId: run.schoolId, actorId: session.userId });
      return NextResponse.json({ run: updated });
    }
    if (!requirePermission(session, "payroll.finalise")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const updated = await finalisePayrollRun({ runId: id, schoolId: run.schoolId, actorId: session.userId });
    return NextResponse.json({ run: updated });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Payroll action failed" },
      { status: 400 }
    );
  }
}
