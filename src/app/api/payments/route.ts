import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter, canAccessSchool } from "@/lib/rbac";
import { paymentSchema } from "@/lib/validators";
import { deriveInvoiceStatus } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyStudentGuardians } from "@/lib/notifications";
import { postPaymentToStudentLedger } from "@/lib/student-ledger";
import { nextReceiptNumber } from "@/lib/finance-catalog";
import { allocatePaymentManual, allocatePaymentToOldest } from "@/lib/payment-allocation";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { assertPaidAtAcceptable, parseCollectionPaidAt } from "@/lib/fee-collection";

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

  const { invoiceId, amount, method, reference, notes, allocations, paidAt: paidAtRaw } = parsed.data;

  let paidAt: Date | undefined;
  if (paidAtRaw) {
    const parsedPaidAt = parseCollectionPaidAt(paidAtRaw);
    if (!parsedPaidAt) {
      return NextResponse.json({ message: "Invalid collection date and time" }, { status: 400 });
    }
    const paidAtError = assertPaidAtAcceptable(parsedPaidAt);
    if (paidAtError) {
      return NextResponse.json({ message: paidAtError }, { status: 400 });
    }
    paidAt = parsedPaidAt;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { userId: true, firstName: true, lastName: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
  }
  if (!canAccessSchool(session!, invoice.schoolId)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
    return NextResponse.json({ message: "This invoice cannot accept collections" }, { status: 400 });
  }

  const denied = await requireLicenseWrite(invoice.schoolId, { feature: "finance" });
  if (denied) return denied;

  const newAmountPaid = Number(invoice.amountPaid) + amount;
  const total = Number(invoice.total);

  if (newAmountPaid > total + 0.01) {
    return NextResponse.json({ message: "Payment exceeds invoice total" }, { status: 400 });
  }

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId,
        amount,
        method,
        reference: reference || null,
        notes: notes || null,
        receiptNumber: await nextReceiptNumber(invoice.schoolId),
        recordedById: session!.userId,
        ...(paidAt ? { paidAt } : {}),
      },
    });
  } catch {
    payment = await prisma.payment.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId,
        amount,
        method,
        reference: reference || null,
        notes: notes || null,
        receiptNumber: `${await nextReceiptNumber(invoice.schoolId)}-R`,
        recordedById: session!.userId,
        ...(paidAt ? { paidAt } : {}),
      },
    });
  }

  const newStatus = deriveInvoiceStatus(total, newAmountPaid, invoice.dueDate, invoice.status);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  await logAudit({
    schoolId: session!.schoolId,
    userId: session!.userId,
    action: "PAYMENT_RECEIVED",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId,
      amount,
      method,
      receiptNumber: payment.receiptNumber,
      paidAt: payment.paidAt.toISOString(),
    },
  });

  if (allocations?.length) {
    await allocatePaymentManual({
      schoolId: invoice.schoolId,
      paymentId: payment.id,
      invoiceId,
      allocations,
    });
  } else {
    await allocatePaymentToOldest({
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      paymentId: payment.id,
      invoiceId,
      amount,
    });
  }

  await postPaymentToStudentLedger({
    schoolId: invoice.schoolId,
    studentId: invoice.studentId,
    paymentId: payment.id,
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    method,
    reference: reference || null,
    recordedById: session!.userId,
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
