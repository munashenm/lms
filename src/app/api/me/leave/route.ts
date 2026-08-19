import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedLearner } from "@/lib/learner-scope";
import { studentAbsenceSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { notifyUser, notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const requests = await prisma.studentAbsenceRequest.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const denied = await requireLicenseWrite(student.schoolId, { feature: "student_leave" });
  if (denied) return denied;

  const school = await prisma.school.findUnique({
    where: { id: student.schoolId },
    select: { studentLeaveRequiresGuardian: true },
  });
  if (school?.studentLeaveRequiresGuardian) {
    return NextResponse.json(
      { message: "This institution requires a parent or guardian to submit leave requests." },
      { status: 403 }
    );
  }

  const parsed = studentAbsenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const fromDate = new Date(parsed.data.fromDate);
  const toDate = new Date(parsed.data.toDate);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const created = await prisma.studentAbsenceRequest.create({
    data: {
      schoolId: student.schoolId,
      studentId: student.id,
      type: parsed.data.type,
      fromDate,
      toDate,
      reason: parsed.data.reason,
      documentUrl: parsed.data.documentUrl || null,
    },
  });

  await notifySchoolRoles({
    schoolId: student.schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL],
    title: "Learner leave request",
    message: `${student.firstName} ${student.lastName} submitted a leave request.`,
    type: "ATTENDANCE",
    link: "/admin/learner-leave",
  });

  if (student.classId) {
    const classTeachers = await prisma.classTeacher.findMany({
      where: { classId: student.classId },
      include: { teacher: { select: { userId: true } } },
    });
    for (const row of classTeachers) {
      if (row.teacher.userId) {
        await notifyUser({
          userId: row.teacher.userId,
          schoolId: student.schoolId,
          title: "Learner leave request",
          message: `${student.firstName} ${student.lastName} submitted a leave request.`,
          type: "ATTENDANCE",
          link: "/teacher/learner-leave",
        });
      }
    }
  }

  return NextResponse.json({ request: created }, { status: 201 });
}
