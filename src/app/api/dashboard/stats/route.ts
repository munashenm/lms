import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessAdmin, getSchoolFilter } from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolFilter = getSchoolFilter(session);

  const [
    totalStudents,
    activeStudents,
    totalTeachers,
    totalClasses,
    outstandingInvoices,
    todayAttendance,
  ] = await Promise.all([
    prisma.student.count({ where: schoolFilter }),
    prisma.student.count({ where: { ...schoolFilter, status: "ACTIVE" } }),
    prisma.teacher.count({ where: schoolFilter }),
    prisma.class.count({ where: { ...schoolFilter, isActive: true } }),
    prisma.invoice.aggregate({
      where: {
        ...schoolFilter,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.attendanceRecord.count({
      where: {
        student: schoolFilter,
        date: new Date(new Date().toISOString().split("T")[0]),
        status: "PRESENT",
      },
    }),
  ]);

  const outstanding =
    Number(outstandingInvoices._sum.total ?? 0) -
    Number(outstandingInvoices._sum.amountPaid ?? 0);

  return NextResponse.json({
    stats: {
      totalStudents,
      activeStudents,
      totalTeachers,
      totalClasses,
      outstandingFees: outstanding,
      todayPresent: todayAttendance,
    },
  });
}
