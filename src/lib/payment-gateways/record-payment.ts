import { PaymentMethod, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { deriveInvoiceStatus } from "../finance";
import { notifyUser, notifySchoolRoles } from "../notifications";
import { notifyDocumentsReleasedIfClear } from "../academic-document-notice";
import { getDocumentRelease } from "../fee-clearance";
import { postPaymentToStudentLedger } from "../student-ledger";
import { allocatePaymentToOldest } from "../payment-allocation";
import { logAudit } from "../audit";

interface RecordGatewayPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export async function recordGatewayPayment(params: RecordGatewayPaymentParams) {
  const settled = await prisma.$transaction(async (tx) => {
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
      return { ok: true as const, duplicate: true as const };
    }

    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    const last = await tx.payment.findFirst({
      where: { schoolId: invoice.schoolId, receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });
    const seq = last?.receiptNumber ? Number(last.receiptNumber.slice(prefix.length)) + 1 : 1;
    const receiptNumber = `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(5, "0")}`;
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

  if (!settled.ok) return settled;
  if (settled.duplicate) return { ok: true as const, duplicate: true };

  const { invoice, payment } = settled;
  const previousRelease = await getDocumentRelease(invoice.studentId);

  await allocatePaymentToOldest({
    schoolId: invoice.schoolId,
    studentId: invoice.studentId,
    paymentId: payment.id,
    invoiceId: params.invoiceId,
    amount: params.amount,
  });

  await postPaymentToStudentLedger({
    schoolId: invoice.schoolId,
    studentId: invoice.studentId,
    paymentId: payment.id,
    invoiceId: params.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    amount: params.amount,
    method: params.method,
    reference: params.reference,
  });

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

  return { ok: true as const, duplicate: false };
}
