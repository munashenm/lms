import { PaymentMethod, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { deriveInvoiceStatus } from "../finance";
import { notifyUser, notifySchoolRoles } from "../notifications";
import { notifyDocumentsReleasedIfClear } from "../academic-document-notice";
import { getDocumentRelease } from "../fee-clearance";
import { postPaymentToStudentLedger } from "../student-ledger";
import { allocatePaymentToOldest } from "../payment-allocation";
import { logAudit } from "../audit";
import { nextReceiptNumber } from "../finance-catalog";

interface RecordGatewayPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

async function repairGatewayPosting(
  invoice: { id: string; schoolId: string; studentId: string; invoiceNumber: string },
  payment: { id: string },
  amount: number,
  method: PaymentMethod,
  reference: string
) {
  const allocationCount = await prisma.paymentAllocation.count({ where: { paymentId: payment.id } });
  if (allocationCount === 0) {
    await allocatePaymentToOldest({
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount,
    });
  }
  await postPaymentToStudentLedger({
    schoolId: invoice.schoolId,
    studentId: invoice.studentId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    method,
    reference,
  });
}

async function settleGatewayPayment(params: RecordGatewayPaymentParams) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM invoices WHERE id = ${params.invoiceId} FOR UPDATE
    `;
    if (!locked[0]) {
      return { ok: false as const, reason: "invoice_not_found" as const };
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
      include: {
        student: { select: { userId: true, firstName: true, lastName: true } },
      },
    });
    if (!invoice) {
      return { ok: false as const, reason: "invoice_not_found" as const };
    }

    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    if (params.amount > outstanding + 0.01) {
      return { ok: false as const, reason: "amount_mismatch" as const };
    }

    const existing = await tx.payment.findFirst({
      where: {
        reference: params.reference,
        invoiceId: params.invoiceId,
        reversedAt: null,
      },
    });
    if (existing) {
      return { ok: true as const, duplicate: true as const, invoice, payment: existing };
    }

    const receiptNumber = await nextReceiptNumber(invoice.schoolId, tx);
    const newAmountPaid = Number(invoice.amountPaid) + params.amount;
    const total = Number(invoice.total);

    const payment = await tx.payment.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId: params.invoiceId,
        amount: params.amount,
        method: params.method,
        reference: params.reference,
        notes: params.notes,
        receiptNumber,
        gatewayProvider: params.method.toLowerCase(),
        captureStatus: "APPROVED",
        postedAt: new Date(),
        approvedAt: new Date(),
        gatewayStatus: "COMPLETED",
        gatewayTxnId: params.reference,
      },
    });

    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: deriveInvoiceStatus(total, newAmountPaid, invoice.dueDate, invoice.status),
      },
    });

    return { ok: true as const, duplicate: false as const, invoice, payment };
  });
}

export async function recordGatewayPayment(params: RecordGatewayPaymentParams) {
  let settled: Awaited<ReturnType<typeof settleGatewayPayment>>;
  try {
    settled = await settleGatewayPayment(params);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true as const, duplicate: true as const };
    }
    throw error;
  }

  if (!settled.ok) return settled;
  if (settled.duplicate) {
    await repairGatewayPosting(settled.invoice, settled.payment, params.amount, params.method, params.reference);
    return { ok: true as const, duplicate: true };
  }

  const { invoice, payment } = settled;
  const previousRelease = await getDocumentRelease(invoice.studentId);

  await repairGatewayPosting(invoice, payment, params.amount, params.method, params.reference);

  await logAudit({
    schoolId: invoice.schoolId,
    action: "PAYMENT_RECEIVED",
    entity: "Payment",
    entityId: payment.id,
    metadata: { method: params.method, gateway: true, receiptNumber: payment.receiptNumber },
  });

  const methodLabel = params.method.replace("_", " ");

  if (invoice.student.userId) {
    await notifyUser({
      userId: invoice.student.userId,
      schoolId: invoice.schoolId,
      title: "Payment received",
      message: `Your payment of R${params.amount.toFixed(2)} for ${invoice.invoiceNumber} was successful.`,
      type: "FEE",
      link: `/student/fees/${params.invoiceId}`,
    });
  }

  await notifySchoolRoles({
    schoolId: invoice.schoolId,
    roles: [UserRole.FINANCE_OFFICER, UserRole.SCHOOL_ADMIN],
    title: `${methodLabel} payment`,
    message: `${invoice.student.firstName} ${invoice.student.lastName} paid R${params.amount.toFixed(2)} via ${methodLabel}.`,
    type: "FEE",
    link: `/finance/invoices/${params.invoiceId}`,
  });

  await notifyDocumentsReleasedIfClear({
    studentId: invoice.studentId,
    schoolId: invoice.schoolId,
    studentUserId: invoice.student.userId,
    previous: previousRelease,
  });

  const { syncDepositApplicationsForInvoice } = await import("../admissions-deposit");
  await syncDepositApplicationsForInvoice({
    invoiceId: params.invoiceId,
    actorId: "gateway",
  });

  return { ok: true as const, duplicate: false };
}
