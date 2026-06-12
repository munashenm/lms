import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { leaveStatusSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "staff:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = leaveStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findFirst({
    where: { id, ...getSchoolFilter(session!) },
    include: { teacher: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const leaveRequest = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes ?? undefined,
      reviewedById: session!.userId,
      reviewedAt: new Date(),
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  if (parsed.data.status === "APPROVED" && existing.teacherId) {
    const now = new Date();
    if (existing.startDate <= now && existing.endDate >= now) {
      await prisma.teacher.update({
        where: { id: existing.teacherId },
        data: { status: "ON_LEAVE" },
      });
    }
  }

  return NextResponse.json({ leaveRequest });
}
