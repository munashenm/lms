import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const employee = await prisma.employee.findUnique({
    where: { userId: session.userId },
    include: {
      payrollItems: {
        where: { payslip: { isNot: null } },
        include: { payslip: true, run: { select: { periodStart: true, periodEnd: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 24,
      },
      leaveEntitlements: { include: { leavePolicy: true } },
    },
  });
  if (!employee || employee.schoolId !== session.schoolId) {
    return NextResponse.json({ payslips: [], entitlements: [] });
  }
  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department,
      position: employee.position,
    },
    payslips: employee.payrollItems.map((item) => ({
      id: item.payslip?.id,
      number: item.payslip?.number,
      netPay: Number(item.netPay),
      periodStart: item.run.periodStart,
      periodEnd: item.run.periodEnd,
      status: item.run.status,
    })),
    entitlements: employee.leaveEntitlements.map((row) => ({
      policy: row.leavePolicy.name,
      type: row.leavePolicy.leaveType,
      opening: Number(row.openingBalance),
      accrued: Number(row.accrued),
      taken: Number(row.taken),
      remaining: Number(row.openingBalance) + Number(row.accrued) - Number(row.taken),
    })),
  });
}
