import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission, canAccessSchool } from "@/lib/rbac";
import { studentAbsenceReviewSchema } from "@/lib/validators";
import { nextAbsenceStatus } from "@/lib/learner-portal";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { getTeacherForSession } from "@/lib/portal-data";
import { notifyUser } from "@/lib/notifications";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    !hasPermission(session.role, "attendance:write") &&
    !hasPermission(session.role, "students:write") &&
    session.role !== UserRole.TEACHER
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.studentAbsenceRequest.findUnique({
    where: { id },
    include: { student: { select: { id: true, classId: true, userId: true, firstName: true, lastName: true } } },
  });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "student_leave" });
  if (denied) return denied;

  if (session.role === UserRole.TEACHER) {
    const teacher = await getTeacherForSession(session);
    const classIds = new Set([
      ...(teacher?.classTeachers.map((ct) => ct.classId) ?? []),
    ]);
    const taught = await prisma.classSubject.findMany({
      where: { teacherId: teacher?.id ?? "__none__" },
      select: { classId: true },
    });
    for (const row of taught) classIds.add(row.classId);
    if (!existing.student.classId || !classIds.has(existing.student.classId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const parsed = studentAbsenceReviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const next = nextAbsenceStatus(existing.status, parsed.data.action);
  if (!next) {
    return NextResponse.json({ message: "This request has already been reviewed" }, { status: 400 });
  }

  const updated = await prisma.studentAbsenceRequest.update({
    where: { id },
    data: {
      status: next,
      reviewedById: session.userId,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote ?? null,
    },
  });

  if (existing.student.userId) {
    await notifyUser({
      userId: existing.student.userId,
      schoolId: existing.schoolId,
      title: `Leave request ${next.toLowerCase()}`,
      message: `Your leave request was ${next.toLowerCase()}.`,
      type: "ATTENDANCE",
      link: "/student/leave",
    });
  }

  return NextResponse.json({ request: updated });
}
