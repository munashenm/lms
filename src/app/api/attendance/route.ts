import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { attendanceBulkSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { getTeacherForSession } from "@/lib/portal-data";
import { buildAttendanceSessionKey } from "@/lib/attendance";
import { licenseDeniedResponse, licenseWriteGuard } from "@/lib/licensing/enforce";
import { assertStudentsInSchool, classInSchool } from "@/lib/tenant";
import { requireSchoolId } from "@/lib/portal-data";
import { tenantMiss } from "@/lib/authorize";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "attendance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const moduleId = searchParams.get("moduleId");
  const studentId = searchParams.get("studentId");
  const date = searchParams.get("date");

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(classId && { classId }),
      ...(moduleId && { moduleId }),
      ...(studentId && { studentId }),
      ...(date && { date: new Date(date) }),
      student: getSchoolFilter(session),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      class: { select: { name: true } },
      module: { select: { name: true, code: true } },
      subject: { select: { name: true, code: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
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
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    classId,
    moduleId,
    subjectId,
    sessionStart,
    sessionEnd,
    date,
    records,
  } = parsed.data;

  const schoolId =
    session!.schoolId ?? (await getTeacherForSession(session!))?.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }
  if (classId) {
    const klass = await classInSchool(classId, schoolId);
    if (!klass) return tenantMiss();
  }
  const studentIds = records.map((record) => record.studentId);
  if (!(await assertStudentsInSchool(studentIds, schoolId))) {
    return tenantMiss();
  }

  const guard = await licenseWriteGuard({ schoolId, feature: "attendance", action: "write" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  const attendanceDate = new Date(date);
  const teacher = await getTeacherForSession(session);
  const markedBy = teacher?.id ?? session!.userId;
  const sessionKey = buildAttendanceSessionKey({
    classId,
    moduleId,
    subjectId,
    sessionStart,
    sessionEnd,
  });

  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true, academicYear: getSchoolFilter(session!) },
  });

  const results = await Promise.all(
    records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          studentId_date_sessionKey: {
            studentId: record.studentId,
            date: attendanceDate,
            sessionKey,
          },
        },
        create: {
          studentId: record.studentId,
          classId: classId || null,
          moduleId: moduleId || null,
          subjectId: subjectId || null,
          sessionKey,
          sessionStart: sessionStart || null,
          sessionEnd: sessionEnd || null,
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
          classId: classId || null,
          moduleId: moduleId || null,
          subjectId: subjectId || null,
          sessionStart: sessionStart || null,
          sessionEnd: sessionEnd || null,
          termId: currentTerm?.id ?? null,
        },
      })
    )
  );

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "BULK_UPDATE",
    entity: "AttendanceRecord",
    metadata: {
      classId,
      moduleId,
      sessionKey,
      date,
      count: results.length,
    },
  });

  let absenceNotifications: { sent: number; skipped: boolean } | undefined;
  if (schoolId) {
    const { notifyAbsenceAlerts } = await import("@/lib/communications");
    const absences = records.filter(
      (r) => r.status === "ABSENT" || r.status === "SICK"
    );
    if (absences.length > 0) {
      absenceNotifications = await notifyAbsenceAlerts({
        schoolId,
        date,
        absences,
      });
    }
  }

  return NextResponse.json({
    saved: results.length,
    sessionKey,
    absenceNotifications,
  });
}
