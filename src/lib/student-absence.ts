import { LeaveStatus, StudentAbsenceType, UserRole, type StudentAbsenceRequest } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifySchoolRoles, notifyUser } from "@/lib/notifications";
import { absenceRangesOverlap } from "@/lib/learner-portal";

export async function createLearnerAbsenceRequest(opts: {
  schoolId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    classId: string | null;
    userId?: string | null;
  };
  type: StudentAbsenceType;
  fromDate: Date;
  toDate: Date;
  reason: string;
  documentUrl?: string | null;
  source: "STUDENT" | "PARENT";
}): Promise<
  | { ok: true; request: StudentAbsenceRequest }
  | { ok: false; status: number; message: string }
> {
  if (Number.isNaN(opts.fromDate.getTime()) || Number.isNaN(opts.toDate.getTime()) || opts.toDate < opts.fromDate) {
    return { ok: false, status: 400, message: "Invalid date range" };
  }

  const existing = await prisma.studentAbsenceRequest.findMany({
    where: {
      studentId: opts.student.id,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
    },
    select: { fromDate: true, toDate: true },
  });
  if (
    existing.some((row) =>
      absenceRangesOverlap(row.fromDate, row.toDate, opts.fromDate, opts.toDate)
    )
  ) {
    return {
      ok: false,
      status: 409,
      message: "A leave request already covers part of these dates.",
    };
  }

  const created = await prisma.studentAbsenceRequest.create({
    data: {
      schoolId: opts.schoolId,
      studentId: opts.student.id,
      type: opts.type,
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      reason: opts.reason,
      documentUrl: opts.documentUrl || null,
    },
  });

  const name = `${opts.student.firstName} ${opts.student.lastName}`;
  const message =
    opts.source === "PARENT"
      ? `A parent submitted a leave request for ${name}.`
      : `${name} submitted a leave request.`;

  await notifySchoolRoles({
    schoolId: opts.schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL],
    title: "Learner leave request",
    message,
    type: "ATTENDANCE",
    link: "/admin/learner-leave",
  });

  if (opts.student.classId) {
    const classTeachers = await prisma.classTeacher.findMany({
      where: { classId: opts.student.classId },
      include: { teacher: { select: { userId: true } } },
    });
    for (const row of classTeachers) {
      if (row.teacher.userId) {
        await notifyUser({
          userId: row.teacher.userId,
          schoolId: opts.schoolId,
          title: "Learner leave request",
          message,
          type: "ATTENDANCE",
          link: "/teacher/learner-leave",
        });
      }
    }
  }

  if (opts.source === "PARENT" && opts.student.userId) {
    await notifyUser({
      userId: opts.student.userId,
      schoolId: opts.schoolId,
      title: "Leave request submitted",
      message: "A parent or guardian submitted a leave request for you.",
      type: "ATTENDANCE",
      link: "/student/leave",
    });
  }

  return { ok: true, request: created };
}
