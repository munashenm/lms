import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter, canAccessAdmin } from "@/lib/rbac";
import {
  canApplyForLeave,
  getStaffLeaveApplicant,
  SICK_NOTE_MAX_BYTES,
  SICK_NOTE_TYPES,
} from "@/lib/staff-leave";
import { notifySchoolRoles } from "@/lib/notifications";
import { UserRole, LeaveType } from "@prisma/client";

function calcLeaveDays(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

const LEAVE_TYPES = new Set<string>(["ANNUAL", "SICK", "FAMILY", "UNPAID", "OTHER"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const filter = getSchoolFilter(session);
  const include = {
    applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
    teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
  };

  const scope = new URL(request.url).searchParams.get("scope");

  if (scope === "mine" && canApplyForLeave(session.role)) {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { userId: session.userId },
      include,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leaveRequests });
  }

  if (canApplyForLeave(session.role) && !canAccessAdmin(session.role)) {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { userId: session.userId },
      include,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leaveRequests });
  }

  if (!canAccessAdmin(session.role) && !requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: filter,
    include,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leaveRequests });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canApplyForLeave(session.role)) {
    return NextResponse.json({ message: "Staff only" }, { status: 403 });
  }

  const applicant = await getStaffLeaveApplicant(session);
  if (!applicant) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const reason = formData.get("reason") as string;
  const sickNote = formData.get("sickNote") as File | null;

  if (!type || !LEAVE_TYPES.has(type) || !startDateStr || !endDateStr || !reason?.trim()) {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  if (reason.trim().length < 5) {
    return NextResponse.json({ message: "Please provide a reason (min 5 characters)" }, { status: 400 });
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (endDate < startDate) {
    return NextResponse.json({ message: "End date must be after start date" }, { status: 400 });
  }

  let sickNoteUrl: string | null = null;
  let sickNoteFilename: string | null = null;

  if (type === LeaveType.SICK) {
    if (!sickNote || sickNote.size === 0) {
      return NextResponse.json(
        { message: "Sick leave requires a doctor's note or medical certificate upload" },
        { status: 400 }
      );
    }
    if (sickNote.size > SICK_NOTE_MAX_BYTES) {
      return NextResponse.json({ message: "Sick note must be under 5 MB" }, { status: 400 });
    }
    if (sickNote.type && !SICK_NOTE_TYPES.includes(sickNote.type)) {
      return NextResponse.json(
        { message: "Upload a PDF or image (JPG, PNG, WebP)" },
        { status: 400 }
      );
    }

    const bytes = await sickNote.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadsDir = path.join(process.cwd(), "public", "uploads", applicant.schoolId, "leave");
    await mkdir(uploadsDir, { recursive: true });
    const safeName = sickNote.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}-${safeName}`;
    await writeFile(path.join(uploadsDir, filename), buffer);
    sickNoteUrl = `/uploads/${applicant.schoolId}/leave/${filename}`;
    sickNoteFilename = sickNote.name;
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      schoolId: applicant.schoolId,
      userId: applicant.userId,
      teacherId: applicant.teacherId,
      type: type as LeaveType,
      startDate,
      endDate,
      days: calcLeaveDays(startDate, endDate),
      reason: reason.trim(),
      sickNoteUrl,
      sickNoteFilename,
    },
    include: {
      applicant: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  await notifySchoolRoles({
    schoolId: applicant.schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL],
    title: "Leave request",
    message: `${applicant.firstName} ${applicant.lastName} requested ${type.toLowerCase()} leave.`,
    type: "INFO",
    link: "/admin/leave",
  });

  return NextResponse.json({ leaveRequest }, { status: 201 });
}
