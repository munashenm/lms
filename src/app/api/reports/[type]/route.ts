import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  getAttendanceReport,
  getAcademicReport,
  getFinanceReport,
  getAdmissionsReport,
} from "@/lib/reports";
import { toCsv, csvDownloadHeaders } from "@/lib/csv";
import { formatDate } from "@/lib/utils";
import { generateTableReportPdf } from "@/lib/pdf-report";

interface RouteParams {
  params: Promise<{ type: string }>;
}

const REPORT_TYPES = ["attendance", "academic", "finance", "admissions"] as const;

function pdfDownloadHeaders(filename: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}

async function getReportSchoolName(filter: ReturnType<typeof getSchoolFilter>) {
  if (!("schoolId" in filter)) return "SchoolHub SA";
  const school = await prisma.school.findUnique({
    where: { id: filter.schoolId },
    select: { name: true },
  });
  return school?.name ?? "SchoolHub SA";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "reports:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { type } = await params;
  if (!REPORT_TYPES.includes(type as (typeof REPORT_TYPES)[number])) {
    return NextResponse.json({ message: "Invalid report type" }, { status: 400 });
  }

  const filter = getSchoolFilter(session!);
  const format = new URL(request.url).searchParams.get("format");
  const schoolName = await getReportSchoolName(filter);
  const generatedAt = new Date().toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
  });

  if (type === "attendance") {
    const data = await getAttendanceReport(filter);
    if (format === "csv") {
      const csv = toCsv(
        ["Class", "Grade", "Enrolled", "Records", "Present", "Absent", "Late", "Rate %"],
        data.map((r) => [
          r.className,
          r.grade,
          r.enrolled,
          r.totalRecords,
          r.present,
          r.absent,
          r.late,
          r.attendanceRate,
        ])
      );
      return new NextResponse(csv, { headers: csvDownloadHeaders("attendance-report.csv") });
    }
    if (format === "pdf") {
      const pdf = await generateTableReportPdf({
        schoolName,
        title: "Attendance Report",
        subtitle: "Present, absent and late counts per class",
        generatedAt,
        columns: [
          { label: "Class" },
          { label: "Grade" },
          { label: "Enrolled", align: "right" },
          { label: "Present", align: "right" },
          { label: "Absent", align: "right" },
          { label: "Rate %", align: "right" },
        ],
        rows: data.map((r) => [
          r.className,
          r.grade,
          String(r.enrolled),
          String(r.present),
          String(r.absent),
          `${r.attendanceRate}%`,
        ]),
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: pdfDownloadHeaders("attendance-report.pdf"),
      });
    }
    return NextResponse.json({ report: data });
  }

  if (type === "academic") {
    const data = await getAcademicReport(filter);
    if (format === "csv") {
      const csv = toCsv(
        ["Code", "Subject", "Marks", "Average %"],
        data.map((r) => [r.code, r.name, r.markCount, r.averagePercent])
      );
      return new NextResponse(csv, { headers: csvDownloadHeaders("academic-report.csv") });
    }
    if (format === "pdf") {
      const pdf = await generateTableReportPdf({
        schoolName,
        title: "Academic Report",
        subtitle: "Average published marks per subject",
        generatedAt,
        columns: [
          { label: "Code" },
          { label: "Subject" },
          { label: "Marks", align: "right" },
          { label: "Average %", align: "right" },
        ],
        rows: data.map((r) => [
          r.code,
          r.name,
          String(r.markCount),
          `${r.averagePercent}%`,
        ]),
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: pdfDownloadHeaders("academic-report.pdf"),
      });
    }
    return NextResponse.json({ report: data });
  }

  if (type === "finance") {
    const data = await getFinanceReport(filter);
    if (format === "csv") {
      const csv = toCsv(
        ["Month", "Billed (ZAR)", "Collected (ZAR)"],
        data.monthly.map((r) => [r.month, r.billed.toFixed(2), r.collected.toFixed(2)])
      );
      return new NextResponse(csv, { headers: csvDownloadHeaders("finance-report.csv") });
    }
    if (format === "pdf") {
      const pdf = await generateTableReportPdf({
        schoolName,
        title: "Finance Report",
        subtitle: "Billing and collection overview",
        generatedAt,
        summary: [
          { label: "Total Billed", value: `R${data.summary.totalBilled.toFixed(2)}` },
          { label: "Collected", value: `R${data.summary.totalCollected.toFixed(2)}` },
          { label: "Outstanding", value: `R${data.summary.outstanding.toFixed(2)}` },
        ],
        columns: [
          { label: "Month" },
          { label: "Billed", align: "right" },
          { label: "Collected", align: "right" },
        ],
        rows: data.monthly.map((r) => [
          r.month,
          `R${r.billed.toFixed(2)}`,
          `R${r.collected.toFixed(2)}`,
        ]),
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: pdfDownloadHeaders("finance-report.pdf"),
      });
    }
    return NextResponse.json({ report: data });
  }

  const data = await getAdmissionsReport(filter);
  if (format === "csv") {
    const csv = toCsv(
      ["Name", "Status", "Grade Applied", "Submitted"],
      data.recent.map((r) => [r.name, r.status, r.gradeApplied ?? "", formatDate(r.submittedAt)])
    );
    return new NextResponse(csv, { headers: csvDownloadHeaders("admissions-report.csv") });
  }
  if (format === "pdf") {
    const pdf = await generateTableReportPdf({
      schoolName,
      title: "Admissions Report",
      subtitle: "Application status breakdown",
      generatedAt,
      summary: [
        { label: "Total", value: String(data.total) },
        { label: "Accepted", value: String(data.byStatus.ACCEPTED ?? 0) },
        { label: "Under Review", value: String(data.byStatus.UNDER_REVIEW ?? 0) },
      ],
      columns: [
        { label: "Applicant" },
        { label: "Status" },
        { label: "Grade" },
      ],
      rows: data.recent.map((r) => [r.name, r.status, r.gradeApplied ?? "—"]),
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: pdfDownloadHeaders("admissions-report.pdf"),
    });
  }
  return NextResponse.json({ report: data });
}
