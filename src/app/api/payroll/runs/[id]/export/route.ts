import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { csvDownloadHeaders } from "@/lib/csv";
import { payrollListingCsv } from "@/lib/payroll-listing";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: {
            select: {
              employeeNumber: true,
              firstName: true,
              lastName: true,
              department: true,
              bankName: true,
              bankAccountLast4: true,
            },
          },
        },
      },
    },
  });
  if (!run || !canAccessSchool(session, run.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const csv = payrollListingCsv(run.items);
  return new NextResponse(csv, {
    headers: csvDownloadHeaders(`payroll-${run.id.slice(0, 8)}-listing.csv`),
  });
}
