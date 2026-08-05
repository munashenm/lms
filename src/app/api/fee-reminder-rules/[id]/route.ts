import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { feeReminderRuleUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { describeDaysOffset } from "@/lib/fee-reminder-rules";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const filter = getSchoolFilter(session!);
  const existing = await prisma.feeReminderRule.findFirst({
    where: { id, ...filter },
  });

  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = feeReminderRuleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const rule = await prisma.feeReminderRule.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.daysOffset !== undefined && {
          daysOffset: parsed.data.daysOffset,
        }),
        ...(parsed.data.channel !== undefined && { channel: parsed.data.channel }),
        ...(parsed.data.isEnabled !== undefined && {
          isEnabled: parsed.data.isEnabled,
        }),
        ...(parsed.data.emailTemplate !== undefined && {
          emailTemplate: parsed.data.emailTemplate || null,
        }),
        ...(parsed.data.smsTemplate !== undefined && {
          smsTemplate: parsed.data.smsTemplate || null,
        }),
      },
    });

    await logAudit({
      schoolId: existing.schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "FeeReminderRule",
      entityId: rule.id,
      metadata: parsed.data,
    });

    return NextResponse.json({
      rule: { ...rule, timingLabel: describeDaysOffset(rule.daysOffset) },
    });
  } catch {
    return NextResponse.json(
      { message: "A rule with this timing and channel already exists" },
      { status: 409 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const filter = getSchoolFilter(session!);
  const existing = await prisma.feeReminderRule.findFirst({
    where: { id, ...filter },
  });

  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  await prisma.feeReminderRule.delete({ where: { id } });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "DELETE",
    entity: "FeeReminderRule",
    entityId: id,
    metadata: { name: existing.name, daysOffset: existing.daysOffset },
  });

  return NextResponse.json({ ok: true });
}
