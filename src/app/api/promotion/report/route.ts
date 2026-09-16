import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { denyUnless } from "@/lib/access";
import { requireSchoolId } from "@/lib/portal-data";
import { csvDownloadHeaders, toCsv } from "@/lib/csv";
import { buildPromotionReport } from "@/lib/promotion";
import { generatePromotionReportPdf } from "@/lib/pdf-promotion";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { pdfFileResponse } from "@/lib/pdf-response";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "reports.export");
  if (denied) return denied;
  const schoolId = await requireSchoolId(session!);
  const yearId = request.nextUrl.searchParams.get("academicYearId");
  const gradeId = request.nextUrl.searchParams.get("gradeId");
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!yearId) return NextResponse.json({ message: "academicYearId is required" }, { status: 400 });

  const report = await buildPromotionReport({
    schoolId,
    academicYearId: yearId,
    gradeId: gradeId || null,
  });

  const headers = [
    "Learner",
    "Admission no",
    "Grade",
    "Average",
    "Attendance",
    "Result",
    "Eligibility",
    "Decision",
    "Destination",
    "Override",
  ];
  const rows = report.rows.map((row) => [
    row.learner,
    row.studentNumber,
    row.grade,
    row.average ?? "",
    row.attendance ?? "",
    row.resultStatus,
    row.eligibility,
    row.decision,
    row.destination,
    row.overridden ? "Yes" : "",
  ]);

  if (format === "pdf") {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const pdf = await generatePromotionReportPdf({
      brand: school ? toSchoolBrand(school) : { name: "SchoolHub SA" },
      title: report.title,
      sessionName: report.sessionName,
      rows: report.rows,
    });
    return pdfFileResponse(pdf, "promotion-report.pdf");
  }

  if (format === "csv" || format === "xlsx") {
    const csv = toCsv(headers, rows);
    return new NextResponse(csv, { headers: csvDownloadHeaders("promotion-report.csv") });
  }

  return NextResponse.json({ title: report.title, sessionName: report.sessionName, headers, rows, decisions: report.rows });
}
