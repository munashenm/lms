import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { attendanceBulkSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { getTeacherForSession } from "@/lib/portal-data";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "attendance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const studentId = searchParams.get("studentId");
  const date = searchParams.get("date");

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(classId && { classId }),
      ...(studentId && { studentId }),
      ...(date && { date: new Date(date) }),
      student: getSchoolFilter(session),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      class: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "attendance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = attendanceBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const { classId, date, records } = parsed.data;
  const attendanceDate = new Date(date);
  const teacher = await getTeacherForSession(session);
  const markedBy = teacher?.id ?? session.userId;

  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true, academicYear: getSchoolFilter(session) },
  });

  const results = await Promise.all(
    records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          studentId_date_classId: {
            studentId: record.studentId,
            date: attendanceDate,
            classId,
          },
        },
        create: {
          studentId: record.studentId,
          classId,
          termId: currentTerm?.id ?? null,
          date: attendanceDate,
          status: record.status,
          notes: record.notes ?? null,
          markedBy,
        },
        update: {
          status: record.status,
          notes: record.notes ?? null,
          markedBy,
        },
      })
    )
  );

  await logAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "BULK_UPDATE",
    entity: "AttendanceRecord",
    metadata: { classId, date, count: results.length },
  });

  return NextResponse.json({ saved: results.length });
}
