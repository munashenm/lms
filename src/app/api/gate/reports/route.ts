import { NextRequest, NextResponse } from "next/server";
import { csvDownloadHeaders, toCsv } from "@/lib/csv";
import { requireSchoolPermission } from "@/lib/gate/access";
import { getGateReport, isGateReportType } from "@/lib/gate/reports";
import { todayKey } from "@/lib/gate/queries";

export async function GET(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:reports");
  if ("error" in auth) return auth.error;
  const type = request.nextUrl.searchParams.get("type");
  if (!isGateReportType(type)) {
    return NextResponse.json({ message: "Unknown report" }, { status: 400 });
  }
  const date = request.nextUrl.searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: "Invalid date" }, { status: 400 });
  }
  const report = await getGateReport(auth.schoolId, type, date);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(report.columns, report.rows), {
      headers: csvDownloadHeaders(`gate-${type}-${date}.csv`),
    });
  }
  return NextResponse.json({ date, ...report });
}
