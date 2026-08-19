import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { leaveStatusSchema } from "@/lib/validators";
import { assertLeaveBalance, syncLeaveTakenOnStatusChange } from "@/lib/leave-entitlement";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "hr.leave.approve") && !requirePermission(session, "staff:write")) {
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

  if (parsed.data.status === "APPROVED" && existing.leavePolicyId && existing.employeeId && existing.type !== "UNPAID") {
    const policy = await prisma.leavePolicy.findUnique({ where: { id: existing.leavePolicyId } });
    if (policy) {
      try {
        await assertLeaveBalance({
          employeeId: existing.employeeId,
          policy,
          days: Number(existing.days),
          asOf: existing.startDate,
        });
      } catch (error) {
        return NextResponse.json(
          { message: error instanceof Error ? error.message : "Insufficient leave balance" },
          { status: 400 }
        );
      }
    }
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

  await syncLeaveTakenOnStatusChange({
    previousStatus: existing.status,
    nextStatus: parsed.data.status,
    employeeId: existing.employeeId,
    leavePolicyId: existing.leavePolicyId,
    days: Number(existing.days),
    startDate: existing.startDate,
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

  await logAudit({
    schoolId: existing.schoolId,
    userId: session!.userId,
    action: parsed.data.status === "APPROVED" ? "LEAVE_APPROVED" : parsed.data.status === "REJECTED" ? "LEAVE_REJECTED" : "LEAVE_UPDATED",
    entity: "LeaveRequest",
    entityId: leaveRequest.id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ leaveRequest });
}
