import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { promotionRuleSchema } from "@/lib/validators";
import { emptyToNull } from "@/lib/class-teachers";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.promotionRule.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session!, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const parsed = promotionRuleSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const rule = await prisma.promotionRule.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.fromGradeId !== undefined ? { fromGradeId: emptyToNull(parsed.data.fromGradeId) } : {}),
      ...(parsed.data.toGradeId !== undefined ? { toGradeId: emptyToNull(parsed.data.toGradeId) } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.minAverage !== undefined ? { minAverage: parsed.data.minAverage } : {}),
      ...(parsed.data.minAttendancePercent !== undefined
        ? { minAttendancePercent: parsed.data.minAttendancePercent }
        : {}),
      ...(parsed.data.requirePassStatus !== undefined ? { requirePassStatus: parsed.data.requirePassStatus } : {}),
      ...(parsed.data.minSubjectsPassed !== undefined ? { minSubjectsPassed: parsed.data.minSubjectsPassed } : {}),
      ...(parsed.data.conditions ? { conditions: parsed.data.conditions } : {}),
    },
  });
  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "PromotionRule",
    entityId: id,
  });
  return NextResponse.json({ rule });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.promotionRule.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session!, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  await prisma.promotionRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
