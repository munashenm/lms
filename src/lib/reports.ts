import { prisma } from "./db";
import { getOutstandingBalance } from "./finance";

type SchoolFilter = { schoolId?: string };

export async function getAttendanceReport(filter: SchoolFilter) {
  const classes = await prisma.class.findMany({
    where: { ...filter, isActive: true },
    include: {
      grade: { select: { name: true } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { student: filter },
    select: { classId: true, status: true },
  });

  return classes.map((cls) => {
    const classRecords = records.filter((r) => r.classId === cls.id);
    const total = classRecords.length;
    const present = classRecords.filter((r) => r.status === "PRESENT").length;
    const absent = classRecords.filter((r) => r.status === "ABSENT").length;
    const late = classRecords.filter((r) => r.status === "LATE").length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      classId: cls.id,
      className: cls.name,
      grade: cls.grade?.name ?? "—",
      enrolled: cls._count.students,
      totalRecords: total,
      present,
      absent,
      late,
      attendanceRate: rate,
    };
  });
}

export async function getAcademicReport(filter: SchoolFilter) {
  const subjects = await prisma.subject.findMany({
    where: filter,
    orderBy: { code: "asc" },
  });

  const marks = await prisma.mark.findMany({
    where: {
      student: filter,
      assessment: { isPublished: true },
    },
    include: {
      assessment: { select: { maxMarks: true, subjectId: true } },
    },
  });

  return subjects.map((subject) => {
    const subjectMarks = marks.filter((m) => m.assessment.subjectId === subject.id);
    const percentages = subjectMarks.map((m) =>
      Math.round((Number(m.score) / Number(m.assessment.maxMarks)) * 100)
    );
    const average =
      percentages.length > 0
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
        : 0;

    return {
      subjectId: subject.id,
      code: subject.code,
      name: subject.name,
      markCount: subjectMarks.length,
      averagePercent: average,
    };
  });
}

export async function getFinanceReport(filter: SchoolFilter) {
  const invoices = await prisma.invoice.findMany({
    where: { ...filter, status: { not: "CANCELLED" } },
    select: { total: true, amountPaid: true, status: true, issuedAt: true },
  });

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const outstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );

  const byStatus = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthly = new Map<string, { collected: number; billed: number }>();
  for (const inv of invoices) {
    const key = inv.issuedAt.toISOString().slice(0, 7);
    const entry = monthly.get(key) ?? { collected: 0, billed: 0 };
    entry.billed += Number(inv.total);
    entry.collected += Number(inv.amountPaid);
    monthly.set(key, entry);
  }

  return {
    summary: { totalBilled, totalCollected, outstanding, invoiceCount: invoices.length },
    byStatus,
    monthly: Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data })),
  };
}

export async function getAdmissionsReport(filter: SchoolFilter) {
  const applications = await prisma.application.findMany({
    where: filter,
    orderBy: { submittedAt: "desc" },
  });

  const byStatus = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    total: applications.length,
    byStatus,
    recent: applications.slice(0, 10).map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      status: a.status,
      gradeApplied: a.gradeApplied,
      submittedAt: a.submittedAt,
    })),
  };
}

export async function getMonthlyEnrollment(filter: SchoolFilter) {
  const students = await prisma.student.findMany({
    where: filter,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const year = new Date().getFullYear();
  const counts = new Array(12).fill(0);

  for (const s of students) {
    if (s.createdAt.getFullYear() === year) {
      counts[s.createdAt.getMonth()]++;
    }
  }

  let cumulative = students.filter((s) => s.createdAt.getFullYear() < year).length;
  return months.map((month, i) => {
    cumulative += counts[i];
    return { month, students: cumulative };
  });
}

export async function getMonthlyFeeCollection(filter: SchoolFilter) {
  const payments = await prisma.payment.findMany({
    where: { invoice: filter },
    select: { amount: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  });

  const invoices = await prisma.invoice.findMany({
    where: { ...filter, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    select: { total: true, amountPaid: true },
  });

  const currentOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const year = new Date().getFullYear();
  const collected = new Array(6).fill(0);

  for (const p of payments) {
    if (p.paidAt.getFullYear() === year && p.paidAt.getMonth() < 6) {
      collected[p.paidAt.getMonth()] += Number(p.amount);
    }
  }

  return months.map((month, i) => ({
    month,
    collected: collected[i],
    outstanding: i === 5 ? currentOutstanding : Math.max(0, currentOutstanding - collected[i] * 0.1),
  }));
}
