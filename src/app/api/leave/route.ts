import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter, canAccessAdmin } from "@/lib/rbac";
import { leaveRequestSchema } from "@/lib/validators";
import { getTeacherForSession } from "@/lib/portal-data";
import { notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";

function calcLeaveDays(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const filter = getSchoolFilter(session);

  if (session.role === UserRole.TEACHER) {
    const teacher = await getTeacherForSession(session);
    if (!teacher) return NextResponse.json({ leaveRequests: [] });

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { teacherId: teacher.id },
      include: {
        teacher: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leaveRequests });
  }

  if (!canAccessAdmin(session.role) && !requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: filter,
    include: {
      teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leaveRequests });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Teachers only" }, { status: 403 });
  }

  const teacher = await getTeacherForSession(session);
  if (!teacher) {
    return NextResponse.json({ message: "Teacher profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return NextResponse.json({ message: "End date must be after start date" }, { status: 400 });
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      schoolId: teacher.schoolId,
      teacherId: teacher.id,
      type: parsed.data.type,
      startDate,
      endDate,
      days: calcLeaveDays(startDate, endDate),
      reason: parsed.data.reason,
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  await notifySchoolRoles({
    schoolId: teacher.schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL],
    title: "Leave request",
    message: `${teacher.firstName} ${teacher.lastName} requested ${parsed.data.type.toLowerCase()} leave.`,
    type: "INFO",
    link: "/admin/leave",
  });

  return NextResponse.json({ leaveRequest }, { status: 201 });
}
