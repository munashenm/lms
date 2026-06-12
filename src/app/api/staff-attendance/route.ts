import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import {
  staffAttendanceBulkSchema,
  staffAttendanceSelfSchema,
} from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  canMarkStaffAttendance,
  canSelfCheckIn,
  currentTimeHHMM,
  getApprovedLeaveUserIds,
} from "@/lib/staff-attendance";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const canView =
    requirePermission(session, "staff:read") ||
    requirePermission(session, "attendance:read");
  if (!canView) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const userId = searchParams.get("userId");
  const schoolFilter = getSchoolFilter(session);

  if (!session.schoolId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "No school context" }, { status: 400 });
  }

  const records = await prisma.staffAttendanceRecord.findMany({
    where: {
      ...schoolFilter,
      ...(dateParam && { date: new Date(dateParam) }),
      ...(userId && { userId }),
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          teacher: { select: { employeeNumber: true, department: true } },
        },
      },
      markedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ date: "desc" }, { user: { lastName: "asc" } }],
    take: 200,
  });

  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  if (body.self === true) {
    if (!canSelfCheckIn(session)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const parsed = staffAttendanceSelfSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = currentTimeHHMM();

    const record = await prisma.staffAttendanceRecord.upsert({
      where: {
        userId_date: { userId: session.userId, date: today },
      },
      create: {
        schoolId: session.schoolId,
        userId: session.userId,
        date: today,
        status: parsed.data.status,
        checkIn,
        notes: parsed.data.notes ?? null,
        markedById: session.userId,
      },
      update: {
        status: parsed.data.status,
        checkIn,
        notes: parsed.data.notes ?? null,
        markedById: session.userId,
      },
    });

    return NextResponse.json({ record, checkIn });
  }

  if (!canMarkStaffAttendance(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = staffAttendanceBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const { date, records } = parsed.data;
  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);
  const onLeaveIds = await getApprovedLeaveUserIds(session.schoolId, attendanceDate);

  const results = await Promise.all(
    records.map((record) => {
      const status =
        onLeaveIds.has(record.userId) && record.status !== "REMOTE"
          ? "ON_LEAVE"
          : record.status;

      return prisma.staffAttendanceRecord.upsert({
        where: {
          userId_date: { userId: record.userId, date: attendanceDate },
        },
        create: {
          schoolId: session.schoolId!,
          userId: record.userId,
          date: attendanceDate,
          status,
          checkIn: record.checkIn ?? null,
          notes: record.notes ?? null,
          markedById: session.userId,
        },
        update: {
          status,
          checkIn: record.checkIn ?? null,
          notes: record.notes ?? null,
          markedById: session.userId,
        },
      });
    })
  );

  await logAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "BULK_UPDATE",
    entity: "StaffAttendanceRecord",
    metadata: { date, count: results.length },
  });

  return NextResponse.json({ saved: results.length });
}
