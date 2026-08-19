import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { generatePayslipPdf } from "@/lib/pdf-payslip";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { formatDate } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

function asLines(json: unknown): Array<{ name: string; amount: number }> {
  if (!Array.isArray(json)) return [];
  return json.map((row) => {
    const rec = row as { name?: string; amount?: number };
    return { name: String(rec.name ?? "Item"), amount: Number(rec.amount ?? 0) };
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      item: {
        include: {
          employee: true,
          run: { include: { school: true } },
        },
      },
    },
  });
  if (!payslip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const schoolId = payslip.item.run.schoolId;
  if (!canAccessSchool(session, schoolId)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const own = payslip.item.employee.userId === session.userId;
  if (!own && !requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const pdf = await generatePayslipPdf({
    brand: toSchoolBrand(payslip.item.run.school),
    payslipNumber: payslip.number,
    employeeName: `${payslip.item.employee.firstName} ${payslip.item.employee.lastName}`,
    employeeNumber: payslip.item.employee.employeeNumber,
    department: payslip.item.employee.department,
    position: payslip.item.employee.position,
    periodLabel: `${formatDate(payslip.item.run.periodStart)} – ${formatDate(payslip.item.run.periodEnd)}`,
    paymentDate: payslip.item.run.paymentDate ? formatDate(payslip.item.run.paymentDate) : null,
    paymentReference: payslip.item.employee.bankAccountLast4
      ? `****${payslip.item.employee.bankAccountLast4}`
      : null,
    earnings: asLines(payslip.item.earningsJson),
    deductions: asLines(payslip.item.deductionsJson),
    employer: asLines(payslip.item.employerJson),
    grossPay: Number(payslip.item.grossPay),
    totalDeductions: Number(payslip.item.totalDeductions),
    netPay: Number(payslip.item.netPay),
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${payslip.number}.pdf"`,
    },
  });
}
