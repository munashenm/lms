import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { denyUnless } from "@/lib/access";
import { requireSchoolId } from "@/lib/portal-data";
import { csvDownloadHeaders, toCsv } from "@/lib/csv";
import { PROMOTION_OUTCOME_LABELS } from "@/lib/promotion";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "reports.export");
  if (denied) return denied;
  const schoolId = await requireSchoolId(session!);
  const yearId = request.nextUrl.searchParams.get("academicYearId");
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  const decisions = await prisma.promotionDecision.findMany({
    where: { schoolId, ...(yearId ? { fromAcademicYearId: yearId } : {}) },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      fromGrade: { select: { name: true } },
      toGrade: { select: { name: true } },
      fromAcademicYear: { select: { name: true } },
      toAcademicYear: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "Learner",
    "Admission no",
    "Session",
    "Average",
    "Attendance",
    "Result",
    "Eligibility",
    "Decision",
    "Destination",
    "Override",
  ];
  const rows = decisions.map((row) => [
    `${row.student.firstName} ${row.student.lastName}`,
    row.student.studentNumber,
    row.fromAcademicYear.name,
    row.average != null ? Number(row.average) : "",
    row.attendancePercent != null ? Number(row.attendancePercent) : "",
    row.resultStatus ?? "",
    row.eligibility,
    row.outcome ? PROMOTION_OUTCOME_LABELS[row.outcome] : "",
    row.toGrade?.name ?? "",
    row.overridden ? "Yes" : "No",
  ]);

  if (format === "csv") {
    const csv = toCsv(headers, rows);
    return new NextResponse(csv, { headers: csvDownloadHeaders("promotion-report.csv") });
  }

  return NextResponse.json({ decisions, headers, rows });
}
