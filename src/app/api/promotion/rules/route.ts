import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { denyUnless } from "@/lib/access";
import { requireSchoolId } from "@/lib/portal-data";
import { promotionRuleSchema } from "@/lib/validators";
import { emptyToNull } from "@/lib/class-teachers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  const denied = await denyUnless(session, "students.promote");
  if (denied) return denied;
  const schoolId = await requireSchoolId(session!);
  const rules = await prisma.promotionRule.findMany({
    where: { schoolId },
    include: { fromGrade: { select: { name: true } }, toGrade: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;
  const schoolId = await requireSchoolId(session!);
  const parsed = promotionRuleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const rule = await prisma.promotionRule.create({
    data: {
      schoolId,
      name: parsed.data.name,
      fromGradeId: emptyToNull(parsed.data.fromGradeId),
      toGradeId: emptyToNull(parsed.data.toGradeId),
      isActive: parsed.data.isActive ?? true,
      minAverage: parsed.data.minAverage ?? null,
      minAttendancePercent: parsed.data.minAttendancePercent ?? null,
      requirePassStatus: parsed.data.requirePassStatus ?? false,
      minSubjectsPassed: parsed.data.minSubjectsPassed ?? null,
      conditions: parsed.data.conditions ?? [],
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "PromotionRule",
    entityId: rule.id,
  });
  return NextResponse.json({ rule }, { status: 201 });
}
