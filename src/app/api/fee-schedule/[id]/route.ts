import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { feeScheduleItemUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

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
  const existing = await prisma.feeScheduleItem.findFirst({
    where: { id, ...filter },
  });

  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = feeScheduleItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const item = await prisma.feeScheduleItem.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.isPublic !== undefined && { isPublic: parsed.data.isPublic }),
    },
  });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "FeeScheduleItem",
    entityId: item.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ item: { ...item, amount: Number(item.amount) } });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const filter = getSchoolFilter(session!);
  const existing = await prisma.feeScheduleItem.findFirst({
    where: { id, ...filter },
  });

  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  await prisma.feeScheduleItem.delete({ where: { id } });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: "DELETE",
    entity: "FeeScheduleItem",
    entityId: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
