import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { authorizeAcademicDocument } from "@/lib/fee-clearance";
import { pdfFileResponse } from "@/lib/pdf-response";
import { academicPdfSnapshotInput, resolveAcademicPdf } from "@/lib/academic-pdf";
import { institutionScope } from "@/lib/tenant";
import { issuedReportCardPdfData } from "@/lib/issue-report-card";
import { generateReportCardPdf } from "@/lib/pdf-report-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { getTerminology } from "@/lib/terminology";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const reportCard = await prisma.reportCard.findFirst({
    where: {
      id,
      publishedAt: { not: null },
      student: institutionScope(session),
    },
    include: {
      academicYear: { select: { name: true } },
      term: { select: { name: true } },
      student: {
        select: {
          schoolId: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          grade: { select: { name: true } },
          class: { select: { name: true } },
          school: {
            select: {
              name: true,
              email: true,
              phone: true,
              website: true,
              address: true,
              city: true,
              province: true,
              postalCode: true,
              logoUrl: true,
              registrationNo: true,
              primaryColor: true,
              accentColor: true,
              institutionType: true,
            },
          },
          marks: {
            select: {
              score: true,
              assessment: {
                select: {
                  title: true,
                  maxMarks: true,
                  weight: true,
                  termId: true,
                  subject: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!reportCard) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const access = await authorizeAcademicDocument({
    session,
    studentId: reportCard.studentId,
    schoolId: reportCard.student.schoolId,
  });
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  let file = await resolveAcademicPdf({ pdfUrl: reportCard.pdfUrl, snapshot: reportCard.snapshot });
  if (!file) {
    try {
      const terms = getTerminology(reportCard.student.school.institutionType);
      const pdfData = issuedReportCardPdfData({
        brand: toSchoolBrand(reportCard.student.school),
        studentName: `${reportCard.student.firstName} ${reportCard.student.lastName}`,
        studentNumber: reportCard.student.studentNumber,
        studentNumberLabel: terms.admissionNumber,
        learnerLabel: terms.student,
        grade: reportCard.student.grade?.name ?? "—",
        className: reportCard.student.class?.name ?? "—",
        academicYear: reportCard.academicYear.name,
        term: reportCard.term?.name ?? "Annual",
        overallAverage: reportCard.overallAverage == null ? null : Number(reportCard.overallAverage),
        comments: reportCard.comments,
        snapshot: reportCard.snapshot,
        marks: reportCard.student.marks,
        termId: reportCard.termId,
      });
      file = Buffer.from(await generateReportCardPdf(pdfData));
      await prisma.reportCard.update({
        where: { id: reportCard.id },
        data: { snapshot: academicPdfSnapshotInput({ kind: "report", data: pdfData }) },
      });
    } catch (err) {
      console.error("[report-card] rebuild failed", err);
    }
  }
  if (!file) return NextResponse.json({ message: "PDF not found" }, { status: 404 });
  return pdfFileResponse(file, `report-card-${id}.pdf`);
}
