import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { paymentSchema } from "@/lib/validators";
import { deriveInvoiceStatus } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyStudentGuardians } from "@/lib/notifications";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { invoice: getSchoolFilter(session!) },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ payments });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const { invoiceId, amount, method, reference, notes } = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { userId: true, firstName: true, lastName: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
  }

  const newAmountPaid = Number(invoice.amountPaid) + amount;
  const total = Number(invoice.total);

  if (newAmountPaid > total + 0.01) {
    return NextResponse.json({ message: "Payment exceeds invoice total" }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: { invoiceId, amount, method, reference: reference || null, notes: notes || null },
  });

  const newStatus = deriveInvoiceStatus(total, newAmountPaid, invoice.dueDate, invoice.status);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  await logAudit({
    schoolId: session!.schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    metadata: { invoiceId, amount, method },
  });

  if (invoice.student.userId) {
    await notifyUser({
      userId: invoice.student.userId,
      schoolId: invoice.schoolId,
      title: "Payment recorded",
      message: `R${amount.toFixed(2)} received for ${invoice.invoiceNumber}.`,
      type: "FEE",
      link: `/student/fees/${invoiceId}`,
    });
  }
  await notifyStudentGuardians({
    studentId: invoice.studentId,
    schoolId: invoice.schoolId,
    title: "Fee payment recorded",
    message: `R${amount.toFixed(2)} paid for ${invoice.invoiceNumber}.`,
    type: "FEE",
    link: `/parent/fees/${invoiceId}`,
  });

  return NextResponse.json({ payment, amountPaid: newAmountPaid, status: newStatus }, { status: 201 });
}
