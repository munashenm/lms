import { PaymentCaptureStatus, PaymentMethod, Prisma, StudentLedgerType } from "@prisma/client";
import { prisma } from "./db";
import { deriveInvoiceStatus, paymentPostingDecision, paymentRequiresVerification, splitPaymentAgainstInvoice } from "./finance";
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
  const outcome = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as Prisma.TransactionClient;
    const locked = await db.$queryRaw<Array<{
      id: string;
      postedAt: Date | null;
      captureStatus: PaymentCaptureStatus;
      reversalOfId: string | null;
      reversedAt: Date | null;
    }>>`
      SELECT id, "postedAt", "captureStatus", "reversalOfId", "reversedAt"
      FROM "payments"
      WHERE id = ${opts.paymentId}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new Error("Payment not found");
    const decision = paymentPostingDecision(row);
    if (decision === "blocked") throw new Error("This payment cannot be posted");

    const payment = await db.payment.findUnique({
      where: { id: opts.paymentId },
      include: {
        invoice: { include: { student: { select: { userId: true, firstName: true, lastName: true } } } },
      },
    });
    if (!payment) throw new Error("Payment not found");
    if (decision === "already_posted") return { payment, applied: false as const };

    await db.$queryRaw`SELECT id FROM "invoices" WHERE id = ${payment.invoiceId} FOR UPDATE`;
    const invoice = await db.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) throw new Error("Invoice not found");

    const existingLedger = await db.studentLedgerEntry.findFirst({
      where: { paymentId: payment.id, type: StudentLedgerType.PAYMENT },
      select: { id: true },
    });
    if (existingLedger) {
      const posted = await db.payment.update({
        where: { id: payment.id },
        data: {
          captureStatus: PaymentCaptureStatus.APPROVED,
          postedAt: payment.postedAt ?? new Date(),
          approvedAt: payment.approvedAt ?? new Date(),
          approvedById: payment.approvedById ?? opts.userId,
        },
      });
      return { payment: { ...payment, ...posted }, applied: false as const };
    }

    const amount = Number(payment.amount);
    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    const { applied, credit } = splitPaymentAgainstInvoice(amount, outstanding);
    const newAmountPaid = Number(invoice.amountPaid) + applied;
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        status: deriveInvoiceStatus(Number(invoice.total), newAmountPaid, invoice.dueDate, invoice.status),
      },
    });

    if (opts.allocations?.length) {
      await allocatePaymentManual({
        schoolId: invoice.schoolId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        allocations: opts.allocations,
        db,
      });
    } else if (applied > 0) {
      await allocatePaymentToOldest({
        schoolId: invoice.schoolId,
        studentId: invoice.studentId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: applied,
        db,
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
        db,
      });
    }

    if (credit > 0.009) {
      const number = await nextCreditNoteNumber(invoice.schoolId, db);
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
        db,
      });
      await db.creditNote.create({
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
      await db.payment.update({
        where: { id: payment.id },
        data: { overpaymentCredit: credit },
      });
    }

    const posted = await db.payment.update({
      where: { id: payment.id },
      data: {
        captureStatus: PaymentCaptureStatus.APPROVED,
        postedAt: new Date(),
        approvedAt: new Date(),
        approvedById: opts.userId,
      },
    });
    return { payment: { ...payment, ...posted, invoice: payment.invoice }, applied: true as const, amount, appliedAmount: applied, credit };
  });

  const payment = outcome.payment;
  if (!outcome.applied) return payment;

  const invoice = payment.invoice;
  const amount = outcome.amount;
  const applied = outcome.appliedAmount;
  const credit = outcome.credit;
  const previousRelease = await getDocumentRelease(invoice.studentId);

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

  // Dynamic import avoids a circular dependency with admissions-deposit → createManualPayment.
  const { syncDepositApplicationsForInvoice } = await import("./admissions-deposit");
  await syncDepositApplicationsForInvoice({
    invoiceId: invoice.id,
    actorId: opts.userId,
  });

  return payment;
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

  const paymentData = {
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
    recordedById: opts.recordedById,
    captureStatus: status,
    ...(opts.paidAt ? { paidAt: opts.paidAt } : {}),
  };

  let payment;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      payment = await prisma.payment.create({
        data: {
          ...paymentData,
          receiptNumber: await nextReceiptNumber(opts.schoolId),
        },
      });
      break;
    } catch (error) {
      const unique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!unique || attempt === 2) throw error;
    }
  }
  if (!payment) throw new Error("Could not allocate a receipt number");

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
