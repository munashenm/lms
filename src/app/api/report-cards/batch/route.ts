import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getTeacherForSession } from "@/lib/portal-data";
import { UserRole } from "@prisma/client";
import { reportCardBatchSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { issueReportCard, reportCardBatchSkipReason } from "@/lib/issue-report-card";

const MAX_BATCH = 120;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = reportCardBatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const classId = parsed.data.classId;
  const academicYearId = parsed.data.academicYearId;
  const termId = parsed.data.termId || undefined;
  const comments = parsed.data.comments || undefined;

  if (session.role === UserRole.TEACHER) {
    const teacher = await getTeacherForSession(session);
    const classIds = teacher?.classTeachers.map((ct) => ct.classId) ?? [];
    if (!classIds.includes(classId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const classRow = await prisma.class.findFirst({
    where: { id: classId, ...getSchoolFilter(session!) },
    select: { id: true, name: true, schoolId: true },
  });
  if (!classRow) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(classRow.schoolId, { feature: "assessments" });
  if (denied) return denied;

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId: classRow.schoolId },
  });
  if (!academicYear) {
    return NextResponse.json({ message: "Academic year not found" }, { status: 404 });
  }
  const term = termId
    ? await prisma.term.findFirst({
        where: { id: termId, academicYear: { schoolId: classRow.schoolId } },
      })
    : null;
  if (termId && !term) {
    return NextResponse.json({ message: "Term not found" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { classId, status: "ACTIVE", ...getSchoolFilter(session!) },
    include: {
      grade: true,
      class: true,
      school: true,
      marks: {
        where: termId ? { assessment: { termId } } : {},
        include: { assessment: { include: { subject: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  if (students.length > MAX_BATCH) {
    return NextResponse.json(
      { message: `Class has ${students.length} learners. Generate in groups of ${MAX_BATCH} or fewer.` },
      { status: 400 }
    );
  }

  const already = await prisma.reportCard.findMany({
    where: {
      studentId: { in: students.map((student) => student.id) },
      academicYearId,
      termId: term?.id ?? null,
    },
    select: { studentId: true },
  });
  const alreadyIds = new Set(already.map((row) => row.studentId));

  const generated: Array<{ studentId: string; name: string; reportCardId: string }> = [];
  const skipped: Array<{ studentId: string; name: string; reason: string }> = [];

  for (const student of students) {
    const name = `${student.firstName} ${student.lastName}`;
    const reason = reportCardBatchSkipReason({
      alreadyIssued: alreadyIds.has(student.id),
      hasMarks: student.marks.length > 0,
    });
    if (reason) {
      skipped.push({ studentId: student.id, name, reason });
      continue;
    }
    const reportCard = await issueReportCard({
      student,
      academicYear,
      term,
      comments,
      userId: session.userId,
    });
    generated.push({ studentId: student.id, name, reportCardId: reportCard.id });
  }

  return NextResponse.json(
    {
      className: classRow.name,
      academicYear: academicYear.name,
      term: term?.name ?? "Annual",
      generated,
      skipped,
    },
    { status: 201 }
  );
}
