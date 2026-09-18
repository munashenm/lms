import { PaymentCaptureStatus, PaymentMethod, StudentLedgerType } from "@prisma/client";
import { prisma } from "./db";
import { deriveInvoiceStatus, paymentRequiresVerification, splitPaymentAgainstInvoice } from "./finance";
import { nextCreditNoteNumber, nextReceiptNumber } from "./finance-catalog";
import { logAudit } from "./audit";
import { notifyUser, notifyStudentGuardians } from "./notifications";
import { notifyDocumentsReleasedIfClear } from "./academic-document-notice";
import { getDocumentRelease } from "./fee-clearance";
import { postPaymentToStudentLedger, createStudentLedgerEntry } from "./student-ledger";
import { allocatePaymentManual, allocatePaymentToOldest } from "./payment-allocation";

export async function assertUniqueBankReference(opts: {
  schoolId: string;
  bankReference: string;
  excludePaymentId?: string;
}) {
  const duplicate = await prisma.payment.findFirst({
    where: {
      schoolId: opts.schoolId,
      bankReference: opts.bankReference,
      reversedAt: null,
      reversalOfId: null,
      captureStatus: { notIn: [PaymentCaptureStatus.REJECTED, PaymentCaptureStatus.REVERSED] },
      ...(opts.excludePaymentId ? { id: { not: opts.excludePaymentId } } : {}),
    },
    select: { id: true },
  });
  return duplicate;
}

export async function postApprovedPayment(opts: {
  paymentId: string;
  userId: string;
  allocations?: Array<{ instalmentId: string; amount: number }>;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: opts.paymentId },
    include: {
      invoice: { include: { student: { select: { userId: true, firstName: true, lastName: true } } } },
    },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.postedAt) return payment;

  const invoice = payment.invoice;
  const amount = Number(payment.amount);
  const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
  const { applied, credit } = splitPaymentAgainstInvoice(amount, outstanding);
  const previousRelease = await getDocumentRelease(invoice.studentId);

  const newAmountPaid = Number(invoice.amountPaid) + applied;
  const newStatus = deriveInvoiceStatus(Number(invoice.total), newAmountPaid, invoice.dueDate, invoice.status);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  if (opts.allocations?.length) {
    await allocatePaymentManual({
      schoolId: invoice.schoolId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      allocations: opts.allocations,
    });
  } else if (applied > 0) {
    await allocatePaymentToOldest({
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: applied,
    });
  }

  if (applied > 0) {
    await postPaymentToStudentLedger({
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: applied,
      method: payment.method,
      reference: payment.bankReference || payment.reference,
      recordedById: opts.userId,
    });
  }

  if (credit > 0.009) {
    const number = await nextCreditNoteNumber(invoice.schoolId);
    const ledger = await createStudentLedgerEntry({
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      type: StudentLedgerType.CREDIT,
      description: `Overpayment credit from ${payment.receiptNumber}`,
      amount: credit,
      invoiceId: invoice.id,
      paymentId: payment.id,
      recordedById: opts.userId,
      reference: number,
    });
    await prisma.creditNote.create({
      data: {
        schoolId: invoice.schoolId,
        studentId: invoice.studentId,
        number,
        amount: credit,
        reason: `Overpayment on ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        ledgerEntryId: ledger.id,
        createdById: opts.userId,
      },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { overpaymentCredit: credit },
    });
  }

  const posted = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      captureStatus: PaymentCaptureStatus.APPROVED,
      postedAt: new Date(),
      approvedAt: new Date(),
      approvedById: opts.userId,
    },
  });

  await logAudit({
    schoolId: invoice.schoolId,
    userId: opts.userId,
    action: "PAYMENT_APPROVED",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId: invoice.id,
      amount,
      applied,
      credit,
      receiptNumber: payment.receiptNumber,
    },
  });

  if (invoice.student.userId) {
    await notifyUser({
      userId: invoice.student.userId,
      schoolId: invoice.schoolId,
      title: "Payment recorded",
      message: `R${amount.toFixed(2)} received for ${invoice.invoiceNumber}.`,
      type: "FEE",
      link: `/student/fees/${invoice.id}`,
    });
  }
  await notifyStudentGuardians({
    studentId: invoice.studentId,
    schoolId: invoice.schoolId,
    title: "Fee payment recorded",
    message: `R${amount.toFixed(2)} paid for ${invoice.invoiceNumber}.`,
    type: "FEE",
    link: `/parent/fees/${invoice.id}`,
  });
  await notifyDocumentsReleasedIfClear({
    studentId: invoice.studentId,
    schoolId: invoice.schoolId,
    studentUserId: invoice.student.userId,
    previous: previousRelease,
  });

  return posted;
}

export async function createManualPayment(opts: {
  schoolId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  bankReference?: string | null;
  notes?: string | null;
  feeType?: string | null;
  academicYearId?: string | null;
  proofUrl?: string | null;
  paidAt?: Date;
  recordedById: string;
  allocations?: Array<{ instalmentId: string; amount: number }>;
  forcePending?: boolean;
}) {
  const pending = opts.forcePending ?? paymentRequiresVerification(opts.method);
  const status = pending ? PaymentCaptureStatus.PENDING : PaymentCaptureStatus.APPROVED;

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        schoolId: opts.schoolId,
        invoiceId: opts.invoiceId,
        amount: opts.amount,
        method: opts.method,
        reference: opts.reference || opts.bankReference || null,
        bankReference: opts.bankReference || opts.reference || null,
        notes: opts.notes || null,
        feeType: opts.feeType || null,
        academicYearId: opts.academicYearId || null,
        proofUrl: opts.proofUrl || null,
        receiptNumber: await nextReceiptNumber(opts.schoolId),
        recordedById: opts.recordedById,
        captureStatus: status,
        ...(opts.paidAt ? { paidAt: opts.paidAt } : {}),
      },
    });
  } catch {
    payment = await prisma.payment.create({
      data: {
        schoolId: opts.schoolId,
        invoiceId: opts.invoiceId,
        amount: opts.amount,
        method: opts.method,
        reference: opts.reference || opts.bankReference || null,
        bankReference: opts.bankReference || opts.reference || null,
        notes: opts.notes || null,
        feeType: opts.feeType || null,
        academicYearId: opts.academicYearId || null,
        proofUrl: opts.proofUrl || null,
        receiptNumber: `${await nextReceiptNumber(opts.schoolId)}-R`,
        recordedById: opts.recordedById,
        captureStatus: status,
        ...(opts.paidAt ? { paidAt: opts.paidAt } : {}),
      },
    });
  }

  await logAudit({
    schoolId: opts.schoolId,
    userId: opts.recordedById,
    action: pending ? "PAYMENT_CAPTURED" : "PAYMENT_RECEIVED",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId: opts.invoiceId,
      amount: opts.amount,
      method: opts.method,
      captureStatus: status,
      receiptNumber: payment.receiptNumber,
    },
  });

  if (!pending) {
    await postApprovedPayment({
      paymentId: payment.id,
      userId: opts.recordedById,
      allocations: opts.allocations,
    });
  }

  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}
