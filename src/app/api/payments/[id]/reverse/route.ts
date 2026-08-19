import { NextRequest, NextResponse } from "next/server";
import { StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { nextReceiptNumber } from "@/lib/finance-catalog";
import { deriveInvoiceStatus } from "@/lib/finance";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance.payments.reverse")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { invoice: true, allocations: true },
  });
  if (!payment || !canAccessSchool(session, payment.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (payment.reversedAt) {
    return NextResponse.json({ message: "Payment already reversed" }, { status: 400 });
  }
  const denied = await requireLicenseWrite(payment.schoolId, { feature: "finance" });
  if (denied) return denied;

  const reversal = await prisma.payment.create({
    data: {
      schoolId: payment.schoolId,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      notes: `Reversal of ${payment.receiptNumber}`,
      receiptNumber: `${await nextReceiptNumber(payment.schoolId)}-REV`,
      reversalOfId: payment.id,
      recordedById: session.userId,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { reversedAt: new Date() },
  });

  const invoice = payment.invoice;
  const newPaid = Math.max(0, Number(invoice.amountPaid) - Number(payment.amount));
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: newPaid,
      status: deriveInvoiceStatus(Number(invoice.total), newPaid, invoice.dueDate, invoice.status),
    },
  });

  for (const alloc of payment.allocations) {
    if (!alloc.instalmentId) continue;
    const inst = await prisma.chargeInstalment.findUnique({ where: { id: alloc.instalmentId } });
    if (!inst) continue;
    const paid = Math.max(0, Number(inst.amountPaid) - Number(alloc.amount));
    await prisma.chargeInstalment.update({
      where: { id: inst.id },
      data: {
        amountPaid: paid,
        status: paid <= 0 ? "PENDING" : paid + 0.001 >= Number(inst.amount) ? "PAID" : "PARTIAL",
      },
    });
  }

  const originalLedger = await prisma.studentLedgerEntry.findFirst({
    where: { paymentId: payment.id, type: StudentLedgerType.PAYMENT },
  });
  await createStudentLedgerEntry({
    schoolId: payment.schoolId,
    studentId: invoice.studentId,
    type: StudentLedgerType.ADJUSTMENT,
    description: `Reversal of receipt ${payment.receiptNumber}`,
    amount: Number(payment.amount),
    signedAmount: Number(payment.amount),
    invoiceId: invoice.id,
    paymentId: reversal.id,
    recordedById: session.userId,
    reversesEntryId: originalLedger?.id ?? null,
  });

  await logAudit({
    schoolId: payment.schoolId,
    userId: session.userId,
    action: "PAYMENT_REVERSED",
    entity: "Payment",
    entityId: payment.id,
    metadata: { reversalId: reversal.id, receiptNumber: payment.receiptNumber },
  });

  return NextResponse.json({ reversal }, { status: 201 });
}
