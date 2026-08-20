import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { reportCardSchema } from "@/lib/validators";
import { calculatePercentage, calculateWeightedAverage, percentageToSymbol } from "@/lib/grading";
import { generateReportCardPdf } from "@/lib/pdf-report-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { getTerminology } from "@/lib/terminology";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { writeAcademicPdf } from "@/lib/pdf-response";
import { isLearnerPortalRole } from "@/lib/fee-clearance";
import { logAudit } from "@/lib/audit";

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

  const reportCards = await prisma.reportCard.findMany({
    where: {
      ...(studentId && { studentId }),
      student: getSchoolFilter(session!),
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

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      class: true,
      school: true,
      marks: {
        where: termId ? { assessment: { termId } } : {},
        include: {
          assessment: {
            include: { subject: true },
          },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(student.schoolId, { feature: "assessments" });
  if (denied) return denied;

  const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  const term = termId ? await prisma.term.findUnique({ where: { id: termId } }) : null;

  const subjectMarks = new Map<string, { name: string; score: number; maxMarks: number; weight: number }>();

  for (const mark of student.marks) {
    const subjectName = mark.assessment.subject?.name ?? mark.assessment.title;
    const existing = subjectMarks.get(subjectName);
    const score = Number(mark.score);
    const max = Number(mark.assessment.maxMarks);
    const weight = Number(mark.assessment.weight ?? 1);

    if (existing) {
      existing.score += score;
      existing.maxMarks += max;
      existing.weight += weight;
    } else {
      subjectMarks.set(subjectName, { name: subjectName, score, maxMarks: max, weight });
    }
  }

  const subjects = Array.from(subjectMarks.values()).map((s) => {
    const percentage = calculatePercentage(s.score, s.maxMarks);
    return {
      name: s.name,
      score: s.score,
      maxMarks: s.maxMarks,
      percentage,
      symbol: percentageToSymbol(percentage),
    };
  });

  const overallAverage = calculateWeightedAverage(
    student.marks.map((m) => ({
      score: Number(m.score),
      maxMarks: Number(m.assessment.maxMarks),
      weight: m.assessment.weight ? Number(m.assessment.weight) : 1,
    }))
  );

  const overallSymbol = percentageToSymbol(overallAverage);

  const pdfBytes = await generateReportCardPdf({
    brand: toSchoolBrand(student.school),
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    studentNumberLabel: getTerminology(student.school.institutionType).admissionNumber,
    learnerLabel: getTerminology(student.school.institutionType).student,
    grade: student.grade?.name ?? "—",
    className: student.class?.name ?? "—",
    academicYear: academicYear?.name ?? "—",
    term: term?.name ?? "Annual",
    subjects,
    overallAverage,
    overallSymbol,
    comments: comments ?? undefined,
  });

  const filename = `report-${student.studentNumber}-${Date.now()}.pdf`;
  const pdfUrl = await writeAcademicPdf("report-cards", filename, pdfBytes);

  const reportCard = await prisma.reportCard.create({
    data: {
      studentId,
      academicYearId,
      termId: termId ?? null,
      overallAverage,
      comments: comments ?? null,
      pdfUrl,
      publishedAt: new Date(),
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      academicYear: true,
      term: true,
    },
  });

  await logAudit({
    schoolId: student.schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "ReportCard",
    entityId: reportCard.id,
    metadata: { studentId, academicYearId, termId: termId ?? null },
  });

  return NextResponse.json({ reportCard }, { status: 201 });
}
