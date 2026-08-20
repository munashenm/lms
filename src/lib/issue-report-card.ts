import { prisma } from "./db";
import { calculatePercentage, calculateWeightedAverage, percentageToSymbol } from "./grading";
import { generateReportCardPdf, type ReportCardData, type ReportCardSubject } from "./pdf-report-card";
import { toSchoolBrand } from "./pdf-branding";
import { getTerminology } from "./terminology";
import { writeAcademicPdf } from "./pdf-response";
import { academicPdfSnapshotInput } from "./academic-pdf";
import { logAudit } from "./audit";
import { notifyAcademicDocumentFamily } from "./academic-document-notice";

export function reportCardBatchSkipReason(opts: { hasMarks: boolean; alreadyIssued: boolean }) {
  if (opts.alreadyIssued) return "Already issued for this year and term";
  if (!opts.hasMarks) return "No marks captured";
  return null;
}

export type ReportCardMark = {
  score: unknown;
  assessment: {
    title: string;
    maxMarks: unknown;
    weight?: unknown | null;
    subject?: { name: string } | null;
  };
};

export function subjectRowsFromMarks(marks: ReportCardMark[]): {
  subjects: ReportCardSubject[];
  overallAverage: number;
  overallSymbol: string;
} {
  const subjectMarks = new Map<string, { name: string; score: number; maxMarks: number; weight: number }>();

  for (const mark of marks) {
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

  const subjects = Array.from(subjectMarks.values()).map((row) => {
    const percentage = calculatePercentage(row.score, row.maxMarks);
    return {
      name: row.name,
      score: row.score,
      maxMarks: row.maxMarks,
      percentage,
      symbol: percentageToSymbol(percentage),
    };
  });

  const overallAverage = calculateWeightedAverage(
    marks.map((mark) => ({
      score: Number(mark.score),
      maxMarks: Number(mark.assessment.maxMarks),
      weight: mark.assessment.weight ? Number(mark.assessment.weight) : 1,
    }))
  );

  return { subjects, overallAverage, overallSymbol: percentageToSymbol(overallAverage) };
}

export type IssueReportCardStudent = {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  grade: { name: string } | null;
  class: { name: string } | null;
  school: Parameters<typeof toSchoolBrand>[0] & { institutionType: Parameters<typeof getTerminology>[0] };
  marks: ReportCardMark[];
};

export function reportCardPdfData(opts: {
  student: IssueReportCardStudent;
  academicYearName: string;
  termName: string;
  comments?: string | null;
}): ReportCardData {
  const { subjects, overallAverage, overallSymbol } = subjectRowsFromMarks(opts.student.marks);
  const terms = getTerminology(opts.student.school.institutionType);
  return {
    brand: toSchoolBrand(opts.student.school),
    studentName: `${opts.student.firstName} ${opts.student.lastName}`,
    studentNumber: opts.student.studentNumber,
    studentNumberLabel: terms.admissionNumber,
    learnerLabel: terms.student,
    grade: opts.student.grade?.name ?? "—",
    className: opts.student.class?.name ?? "—",
    academicYear: opts.academicYearName,
    term: opts.termName,
    subjects,
    overallAverage,
    overallSymbol,
    comments: opts.comments ?? undefined,
  };
}

export async function issueReportCard(opts: {
  student: IssueReportCardStudent;
  academicYear: { id: string; name: string };
  term: { id: string; name: string } | null;
  comments?: string | null;
  userId: string;
}) {
  const pdfData = reportCardPdfData({
    student: opts.student,
    academicYearName: opts.academicYear.name,
    termName: opts.term?.name ?? "Annual",
    comments: opts.comments,
  });
  const pdfBytes = await generateReportCardPdf(pdfData);
  const filename = `report-${opts.student.studentNumber}-${Date.now()}.pdf`;
  const pdfUrl = await writeAcademicPdf("report-cards", filename, pdfBytes);
  const snapshot = academicPdfSnapshotInput({ kind: "report", data: pdfData });

  const reportCard = await prisma.reportCard.create({
    data: {
      studentId: opts.student.id,
      academicYearId: opts.academicYear.id,
      termId: opts.term?.id ?? null,
      overallAverage: pdfData.overallAverage,
      comments: opts.comments ?? null,
      pdfUrl,
      snapshot,
      publishedAt: new Date(),
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      academicYear: true,
      term: true,
    },
  });

  await logAudit({
    schoolId: opts.student.schoolId,
    userId: opts.userId,
    action: "CREATE",
    entity: "ReportCard",
    entityId: reportCard.id,
    metadata: {
      studentId: opts.student.id,
      academicYearId: opts.academicYear.id,
      termId: opts.term?.id ?? null,
    },
  });
  await notifyAcademicDocumentFamily({
    studentId: opts.student.id,
    schoolId: opts.student.schoolId,
    kind: "report",
    title: `${opts.academicYear.name}${opts.term ? ` — ${opts.term.name}` : ""}`,
  });

  return reportCard;
}
