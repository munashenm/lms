import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import {
  getAttendanceReport,
  getAcademicReport,
  getFinanceReport,
  getAdmissionsReport,
} from "@/lib/reports";
import { toCsv, csvDownloadHeaders } from "@/lib/csv";
import { formatDate } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ type: string }>;
}

const REPORT_TYPES = ["attendance", "academic", "finance", "admissions"] as const;

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
  return NextResponse.json({ report: data });
}
