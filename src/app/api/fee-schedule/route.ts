import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { feeScheduleItemSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { UserRole } from "@prisma/client";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId =
    session!.role === UserRole.SUPER_ADMIN
      ? searchParams.get("schoolId") ?? undefined
      : resolveSettingsSchoolId(session!, searchParams.get("schoolId")) ?? undefined;

  const filter = getSchoolFilter(session!);
  const resolvedSchoolId =
    schoolId ?? ("schoolId" in filter ? filter.schoolId : undefined);

  if (!resolvedSchoolId) {
    return NextResponse.json({ message: "School required" }, { status: 400 });
  }

  const items = await prisma.feeScheduleItem.findMany({
    where: { schoolId: resolvedSchoolId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = feeScheduleItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);

  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;

  const item = await prisma.feeScheduleItem.create({
    data: {
      schoolId,
      name: parsed.data.name,
      amount: parsed.data.amount,
      notes: parsed.data.notes || null,
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: parsed.data.isActive ?? true,
      isPublic: parsed.data.isPublic ?? true,
    },
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "FeeScheduleItem",
    entityId: item.id,
    metadata: { name: item.name, amount: Number(item.amount) },
  });

  return NextResponse.json({ item: { ...item, amount: Number(item.amount) } }, { status: 201 });
}
