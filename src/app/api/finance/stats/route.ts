import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getOutstandingBalance } from "@/lib/finance";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const filter = getSchoolFilter(session!);

  const invoices = await prisma.invoice.findMany({
    where: { ...filter, status: { not: "CANCELLED" } },
    select: { total: true, amountPaid: true, status: true },
  });

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );

  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const paidCount = invoices.filter((i) => i.status === "PAID").length;

  const recentPayments = await prisma.payment.findMany({
    where: { invoice: filter },
    orderBy: { paidAt: "desc" },
    take: 5,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          student: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return NextResponse.json({
    stats: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      overdueCount,
      paidCount,
      invoiceCount: invoices.length,
    },
    recentPayments,
  });
}
