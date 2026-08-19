import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { feeReminderRuleSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  describeDaysOffset,
  ensureDefaultFeeReminderRules,
  runFeeReminderRules,
} from "@/lib/fee-reminder-rules";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN &&
    request.nextUrl.searchParams.get("schoolId")
      ? request.nextUrl.searchParams.get("schoolId")!
      : await requireSchoolId(session!);

  await ensureDefaultFeeReminderRules(schoolId);

  const [rules, recentDispatches] = await Promise.all([
    prisma.feeReminderRule.findMany({
      where: { schoolId },
      orderBy: [{ daysOffset: "asc" }, { name: "asc" }],
    }),
    prisma.feeReminderDispatch.findMany({
      where: { schoolId },
      orderBy: { dispatchedAt: "desc" },
      take: 30,
      include: {
        rule: { select: { name: true, daysOffset: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            student: {
              select: { firstName: true, lastName: true, studentNumber: true },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    rules: rules.map((rule) => ({
      ...rule,
      timingLabel: describeDaysOffset(rule.daysOffset),
    })),
    recentDispatches: recentDispatches.map((d) => ({
      id: d.id,
      channel: d.channel,
      dispatchedAt: d.dispatchedAt.toISOString(),
      ruleName: d.rule.name,
      daysOffset: d.rule.daysOffset,
      timingLabel: describeDaysOffset(d.rule.daysOffset),
      invoiceNumber: d.invoice.invoiceNumber,
      studentName: `${d.invoice.student.firstName} ${d.invoice.student.lastName}`,
      studentNumber: d.invoice.student.studentNumber,
      communicationLogId: d.communicationLogId,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  if (body?.action === "run") {
    const schoolId =
      session!.role === UserRole.SUPER_ADMIN && body.schoolId
        ? body.schoolId
        : await requireSchoolId(session!);

    const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
    if (denied) return denied;

    const summary = await runFeeReminderRules({
      schoolId,
      limitPerSchool: 50,
    });

    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "CREATE",
      entity: "FeeReminderDispatch",
      entityId: schoolId,
      metadata: { ...summary, trigger: "manual" },
    });

    return NextResponse.json({ summary });
  }

  const parsed = feeReminderRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);

  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;

  try {
    const rule = await prisma.feeReminderRule.create({
      data: {
        schoolId,
        name: parsed.data.name,
        daysOffset: parsed.data.daysOffset,
        channel: parsed.data.channel,
        isEnabled: parsed.data.isEnabled ?? false,
        emailTemplate: parsed.data.emailTemplate || null,
        smsTemplate: parsed.data.smsTemplate || null,
      },
    });

    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "CREATE",
      entity: "FeeReminderRule",
      entityId: rule.id,
      metadata: {
        name: rule.name,
        daysOffset: rule.daysOffset,
        channel: rule.channel,
      },
    });

    return NextResponse.json(
      { rule: { ...rule, timingLabel: describeDaysOffset(rule.daysOffset) } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { message: "A rule with this timing and channel already exists" },
      { status: 409 }
    );
  }
}
