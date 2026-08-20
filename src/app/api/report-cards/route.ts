import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getTeacherForSession, classIdsForTeacher } from "@/lib/portal-data";
import { UserRole } from "@prisma/client";
import { reportCardSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { isLearnerPortalRole } from "@/lib/fee-clearance";
import { issueReportCard } from "@/lib/issue-report-card";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (isLearnerPortalRole(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const teacher =
    session!.role === UserRole.TEACHER ? await getTeacherForSession(session!) : null;
  const classIds = classIdsForTeacher(teacher);

  const reportCards = await prisma.reportCard.findMany({
    where: {
      ...(studentId && { studentId }),
      student: {
        ...getSchoolFilter(session!),
        ...(teacher ? { classId: { in: classIds } } : {}),
      },
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      academicYear: { select: { name: true } },
      term: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reportCards });
}

const reportStudentInclude = {
  grade: true,
  class: true,
  school: true,
  marks: {
    include: {
      assessment: {
        include: { subject: true },
      },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = reportCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const { studentId, academicYearId, termId, comments } = parsed.data;

  const student = await prisma.student.findFirst({
    where: { id: studentId, ...getSchoolFilter(session!) },
    include: {
      ...reportStudentInclude,
      marks: {
        where: termId ? { assessment: { termId } } : {},
        include: reportStudentInclude.marks.include,
      },
    },
  });

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  if (session.role === UserRole.TEACHER) {
    const teacher = await getTeacherForSession(session);
    const classIds = classIdsForTeacher(teacher);
    if (!student.classId || !classIds.includes(student.classId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const denied = await requireLicenseWrite(student.schoolId, { feature: "assessments" });
  if (denied) return denied;

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId: student.schoolId },
  });
  if (!academicYear) {
    return NextResponse.json({ message: "Academic year not found" }, { status: 404 });
  }
  const term = termId
    ? await prisma.term.findFirst({
        where: { id: termId, academicYear: { schoolId: student.schoolId } },
      })
    : null;
  if (termId && !term) {
    return NextResponse.json({ message: "Term not found" }, { status: 404 });
  }

  const reportCard = await issueReportCard({
    student,
    academicYear,
    term,
    comments,
    userId: session.userId,
  });

  return NextResponse.json({ reportCard }, { status: 201 });
}
