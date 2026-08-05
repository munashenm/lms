import { NextRequest, NextResponse } from "next/server";
import { EnrolmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { enrolmentSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { ensureStudentEnrolment, enrolmentListInclude } from "@/lib/enrolment";
import {
  getViewSessionIdFromCookie,
  resolveViewSession,
} from "@/lib/academic-session";
import { requireSchoolId } from "@/lib/portal-data";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = session!.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const cookieId = await getViewSessionIdFromCookie();
  const viewSession = await resolveViewSession(
    schoolId,
    searchParams.get("academicYearId") ?? cookieId
  );

  const enrolments = await prisma.enrolment.findMany({
    where: {
      academicYearId: viewSession?.id,
      student: getSchoolFilter(session!),
      ...(searchParams.get("status")
        ? { status: searchParams.get("status") as EnrolmentStatus }
        : {}),
      ...(searchParams.get("gradeId") ? { gradeId: searchParams.get("gradeId")! } : {}),
      ...(searchParams.get("classId") ? { classId: searchParams.get("classId")! } : {}),
    },
    include: enrolmentListInclude,
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  return NextResponse.json({
    academicYear: viewSession,
    enrolments,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = enrolmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const filter = getSchoolFilter(session!);
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, ...filter },
  });
  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const year = await prisma.academicYear.findFirst({
    where: { id: parsed.data.academicYearId, schoolId: student.schoolId },
  });
  if (!year) {
    return NextResponse.json({ message: "Academic session not found" }, { status: 404 });
  }

  await ensureStudentEnrolment({
    studentId: student.id,
    schoolId: student.schoolId,
    academicYearId: year.id,
    courseId: parsed.data.courseId,
    gradeId: parsed.data.gradeId,
    classId: parsed.data.classId,
    status: parsed.data.status as EnrolmentStatus | undefined,
  });

  const enrolment = await prisma.enrolment.findFirst({
    where: {
      studentId: student.id,
      academicYearId: year.id,
      ...(parsed.data.courseId ? { courseId: parsed.data.courseId } : {}),
    },
    include: enrolmentListInclude,
    orderBy: { updatedAt: "desc" },
  });

  if (parsed.data.notes && enrolment) {
    await prisma.enrolment.update({
      where: { id: enrolment.id },
      data: { notes: parsed.data.notes },
    });
  }

  await logAudit({
    schoolId: student.schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Enrolment",
    entityId: enrolment?.id,
    metadata: {
      studentId: student.id,
      academicYearId: year.id,
      gradeId: parsed.data.gradeId,
      classId: parsed.data.classId,
    },
  });

  return NextResponse.json({ enrolment }, { status: 201 });
}
