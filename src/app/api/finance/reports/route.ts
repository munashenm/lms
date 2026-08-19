import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { financeOpsSectionCsv, getFinanceOpsReport } from "@/lib/finance-ops-report";
import { csvDownloadHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance.reports.view") && !hasPermission(session.role, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const { searchParams } = new URL(request.url);
  const report = await getFinanceOpsReport(filter, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  const format = searchParams.get("format");
  if (format === "csv") {
    const section = searchParams.get("section") ?? "debtors";
    const csv = financeOpsSectionCsv(section, report);
    if (!csv) return NextResponse.json({ message: "Invalid export section" }, { status: 400 });
    return new NextResponse(csv, { headers: csvDownloadHeaders(`finance-${section}.csv`) });
  }

  return NextResponse.json(report);
}
