import { PaymentMethod, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { deriveInvoiceStatus } from "../finance";
import { notifyUser, notifySchoolRoles } from "../notifications";
import { nextReceiptNumber } from "../finance-catalog";
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
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      student: { select: { userId: true, firstName: true, lastName: true } },
    },
  });

  if (!invoice) {
    return { ok: false as const, reason: "invoice_not_found" };
  }

  const existing = await prisma.payment.findFirst({
    where: { reference: params.reference, invoiceId: params.invoiceId },
  });
  if (existing) {
    return { ok: true as const, duplicate: true };
  }

  const newAmountPaid = Number(invoice.amountPaid) + params.amount;
  const total = Number(invoice.total);

  const payment = await prisma.payment.create({
    data: {
      schoolId: invoice.schoolId,
      invoiceId: params.invoiceId,
      amount: params.amount,
      method: params.method,
      reference: params.reference,
      notes: params.notes,
      receiptNumber: await nextReceiptNumber(invoice.schoolId),
      gatewayProvider: params.method.toLowerCase(),
    },
  });

  const newStatus = deriveInvoiceStatus(
    total,
    newAmountPaid,
    invoice.dueDate,
    invoice.status
  );

  await prisma.invoice.update({
    where: { id: params.invoiceId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

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

  return { ok: true as const, duplicate: false };
}
