import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requireStaffPermission } from "@/lib/rbac";
import { financeOpsSectionCsv, getFinanceOpsReport } from "@/lib/finance-ops-report";
import { csvDownloadHeaders, excelDownloadHeaders, toExcelCsv } from "@/lib/csv";
import { generateTableReportPdf } from "@/lib/pdf-report";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!requireStaffPermission(session, "finance.reports.view") && !requireStaffPermission(session, "finance.reports") && !requireStaffPermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const { searchParams } = new URL(request.url);
  const report = await getFinanceOpsReport(filter, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  const format = searchParams.get("format");
  if (format === "csv" || format === "xlsx" || format === "pdf") {
    if (
      !requireStaffPermission(session, "finance.reports.export") &&
      !requireStaffPermission(session, "finance.reports") &&
      !requireStaffPermission(session, "reports:read")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const section = searchParams.get("section") ?? "debtors";
    const csv = financeOpsSectionCsv(section, report);
    if (!csv) return NextResponse.json({ message: "Invalid export section" }, { status: 400 });
    const headers = csv.split("\n")[0]?.split(",") ?? [];
    const rows = csv
      .split("\n")
      .slice(1)
      .filter(Boolean)
      .map((line) => line.split(","));
    if (format === "pdf") {
      const school = session.schoolId
        ? await prisma.school.findUnique({ where: { id: session.schoolId } })
        : null;
      const pdf = await generateTableReportPdf({
        brand: school ? toSchoolBrand(school) : { name: "SchoolHub SA" },
        title: `Finance ${section} report`,
        generatedAt: new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }),
        columns: headers.map((label) => ({ label })),
        rows,
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="finance-${section}.pdf"`,
        },
      });
    }
    if (format === "xlsx") {
      return new NextResponse(toExcelCsv(headers, rows), { headers: excelDownloadHeaders(`finance-${section}.xls`) });
    }
    return new NextResponse(csv, { headers: csvDownloadHeaders(`finance-${section}.csv`) });
  }

  return NextResponse.json(report);
}
