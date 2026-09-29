import {
  InvoiceStatus,
  PaymentMethod,
  StudentLedgerType,
  StudentStatus,
  type Application,
  type Invoice,
} from "@prisma/client";
import { prisma } from "./db";
import { calculateInvoiceTotals, generateInvoiceNumber, getOutstandingBalance } from "./finance";
import { createManualPayment } from "./manual-payment";
import { createStudentLedgerEntry } from "./student-ledger";
import { logAudit } from "./audit";
import { generateStudentNumber } from "./students";
import { findStudentForApplication } from "./application-enrolment";

const DEPOSIT_FEE_TYPE = "ADMISSIONS_DEPOSIT";

type DepositAmount = number | string | { toString(): string } | null | undefined;

export function depositRequired(application: { depositAmount?: DepositAmount }): boolean {
  return Number(application.depositAmount ?? 0) > 0;
}

export function depositSatisfied(application: {
  depositAmount?: DepositAmount;
  depositPaidAt?: Date | string | null;
  depositWaivedAt?: Date | string | null;
}): boolean {
  if (!depositRequired(application)) return true;
  return Boolean(application.depositPaidAt || application.depositWaivedAt);
}

/** Blocks accept/enrol when a deposit is required and neither paid nor waived. */
export function depositBlocksEnrolment(application: {
  depositAmount?: DepositAmount;
  depositPaidAt?: Date | string | null;
  depositWaivedAt?: Date | string | null;
}): boolean {
  return depositRequired(application) && !depositSatisfied(application);
}

export async function ensureApplicantStudent(params: {
  application: {
    id: string;
    schoolId: string;
    studentId: string | null;
    firstName: string;
    lastName: string;
    saIdNumber: string | null;
    email: string | null;
    phone: string | null;
  };
  actorId: string;
}): Promise<{ studentId: string; created: boolean }> {
  const linked = await findStudentForApplication(params.application);
  if (linked) {
    if (!params.application.studentId) {
      await prisma.application.update({
        where: { id: params.application.id },
        data: { studentId: linked },
      });
    }
    return { studentId: linked, created: false };
  }

  const studentNumber = await generateStudentNumber(params.application.schoolId);
  const student = await prisma.student.create({
    data: {
      schoolId: params.application.schoolId,
      firstName: params.application.firstName,
      lastName: params.application.lastName,
      studentNumber,
      saIdNumber: params.application.saIdNumber,
      email: params.application.email,
      phone: params.application.phone,
      status: StudentStatus.ACTIVE,
    },
  });

  await prisma.application.update({
    where: { id: params.application.id },
    data: { studentId: student.id },
  });

  await logAudit({
    schoolId: params.application.schoolId,
    userId: params.actorId,
    action: "CREATE",
    entity: "Student",
    entityId: student.id,
    metadata: { source: "application_deposit", applicationId: params.application.id },
  });

  return { studentId: student.id, created: true };
}

async function loadActiveDepositInvoice(application: Application): Promise<Invoice | null> {
  if (!application.depositInvoiceId) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { id: application.depositInvoiceId },
  });
  if (!invoice || invoice.status === InvoiceStatus.CANCELLED) return null;
  return invoice;
}

/**
 * Idempotent: creates at most one deposit invoice for an application and stores depositInvoiceId.
 */
export async function ensureDepositInvoice(params: {
  applicationId: string;
  actorId: string;
  depositAmount?: number;
  offerExpiresAt?: Date | null;
}): Promise<{
  application: Application;
  invoice: Invoice | null;
  created: boolean;
}> {
  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
  });
  if (!application) throw new Error("Application not found");

  const amount =
    params.depositAmount !== undefined
      ? params.depositAmount
      : Number(application.depositAmount ?? 0);

  const offerExpiresAt =
    params.offerExpiresAt !== undefined ? params.offerExpiresAt : application.offerExpiresAt;

  if (amount <= 0) {
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        depositAmount: 0,
        status: "OFFER_ISSUED",
        offerSentAt: application.offerSentAt ?? new Date(),
        offerExpiresAt,
      },
    });
    return { application: updated, invoice: null, created: false };
  }

  const existingInvoice = await loadActiveDepositInvoice(application);
  if (existingInvoice) {
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        depositAmount: amount,
        status:
          application.depositPaidAt || application.depositWaivedAt
            ? "DEPOSIT_PAID"
            : "DEPOSIT_PENDING",
        offerSentAt: application.offerSentAt ?? new Date(),
        offerExpiresAt,
      },
    });
    return { application: updated, invoice: existingInvoice, created: false };
  }

  const { studentId } = await ensureApplicantStudent({
    application,
    actorId: params.actorId,
  });

  // Concurrent offer requests: another worker may have linked an invoice.
  const fresh = await prisma.application.findUnique({ where: { id: application.id } });
  if (!fresh) throw new Error("Application not found");
  const raced = await loadActiveDepositInvoice(fresh);
  if (raced) {
    return { application: fresh, invoice: raced, created: false };
  }

  const invoiceNumber = await generateInvoiceNumber(fresh.schoolId, () =>
    prisma.invoice.count({ where: { schoolId: fresh.schoolId } })
  );
  const description = `Admissions deposit — ${fresh.referenceNo}`;
  const { subtotal, total } = calculateInvoiceTotals([{ quantity: 1, unitPrice: amount }], 0);
  const dueDate =
    offerExpiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      schoolId: fresh.schoolId,
      studentId,
      invoiceNumber,
      description,
      subtotal,
      discount: 0,
      total,
      status: InvoiceStatus.SENT,
      dueDate,
      lineItems: {
        create: [
          {
            description,
            quantity: 1,
            unitPrice: amount,
            amount,
          },
        ],
      },
    },
  });

  await createStudentLedgerEntry({
    schoolId: fresh.schoolId,
    studentId,
    type: StudentLedgerType.CHARGE,
    description,
    amount,
    reference: invoiceNumber,
    invoiceId: invoice.id,
    recordedById: params.actorId,
  });

  const updated = await prisma.application.update({
    where: { id: fresh.id },
    data: {
      studentId,
      depositAmount: amount,
      depositInvoiceId: invoice.id,
      status: "DEPOSIT_PENDING",
      offerSentAt: fresh.offerSentAt ?? new Date(),
      offerExpiresAt,
    },
  });

  await logAudit({
    schoolId: fresh.schoolId,
    userId: params.actorId,
    action: "CREATE",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: {
      kind: DEPOSIT_FEE_TYPE,
      applicationId: fresh.id,
      invoiceNumber,
      amount,
    },
  });

  return { application: updated, invoice, created: true };
}

export async function recordApplicationDepositPayment(params: {
  applicationId: string;
  actorId: string;
  amount?: number;
  method?: PaymentMethod;
  reference?: string | null;
}): Promise<{ application: Application; paymentId: string | null; alreadyPaid: boolean }> {
  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
    include: { depositInvoice: true },
  });
  if (!application) throw new Error("Application not found");
  if (!application.depositInvoiceId || !application.depositInvoice) {
    throw new Error("No deposit invoice on this application");
  }
  if (application.depositPaidAt || application.depositWaivedAt) {
    return { application, paymentId: null, alreadyPaid: true };
  }

  const invoice = application.depositInvoice;
  const outstanding = getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid));
  if (outstanding <= 0 || invoice.status === InvoiceStatus.PAID) {
    const updated = await markApplicationDepositPaid({
      applicationId: application.id,
      actorId: params.actorId,
      source: "invoice_already_paid",
    });
    return { application: updated, paymentId: null, alreadyPaid: true };
  }

  const payAmount = params.amount ?? outstanding;
  const payment = await createManualPayment({
    schoolId: application.schoolId,
    invoiceId: invoice.id,
    amount: payAmount,
    method: params.method ?? PaymentMethod.EFT,
    reference: params.reference ?? `DEP-${application.referenceNo}`,
    feeType: DEPOSIT_FEE_TYPE,
    recordedById: params.actorId,
    forcePending: false,
  });

  const updated = await markApplicationDepositPaid({
    applicationId: application.id,
    actorId: params.actorId,
    source: "manual_payment",
    paymentId: payment.id,
  });

  return { application: updated, paymentId: payment.id, alreadyPaid: false };
}

export async function waiveApplicationDeposit(params: {
  applicationId: string;
  actorId: string;
  reason: string;
}): Promise<Application> {
  const reason = params.reason.trim();
  if (!reason) throw new Error("Waiver reason is required");

  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
  });
  if (!application) throw new Error("Application not found");
  if (!depositRequired(application)) {
    return application;
  }
  if (application.depositWaivedAt || application.depositPaidAt) {
    return application;
  }

  if (application.depositInvoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: application.depositInvoiceId },
    });
    if (
      invoice &&
      invoice.status !== InvoiceStatus.CANCELLED &&
      invoice.status !== InvoiceStatus.PAID
    ) {
      const outstanding = getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid));
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED },
      });
      if (outstanding > 0) {
        await createStudentLedgerEntry({
          schoolId: application.schoolId,
          studentId: invoice.studentId,
          type: StudentLedgerType.CREDIT,
          description: `Deposit waived — ${application.referenceNo}`,
          amount: outstanding,
          reference: invoice.invoiceNumber,
          invoiceId: invoice.id,
          recordedById: params.actorId,
          notes: reason,
        });
      }
    }
  }

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      depositWaivedAt: new Date(),
      depositWaiverReason: reason,
      depositWaivedById: params.actorId,
      status: "DEPOSIT_PAID",
    },
  });

  await logAudit({
    schoolId: application.schoolId,
    userId: params.actorId,
    action: "UPDATE",
    entity: "Application",
    entityId: application.id,
    metadata: {
      kind: "DEPOSIT_WAIVER",
      reason,
      depositInvoiceId: application.depositInvoiceId,
    },
  });

  return updated;
}

export async function markApplicationDepositPaid(params: {
  applicationId: string;
  actorId: string;
  source: string;
  paymentId?: string;
}): Promise<Application> {
  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
  });
  if (!application) throw new Error("Application not found");
  if (application.depositPaidAt) return application;

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      depositPaidAt: new Date(),
      status:
        application.status === "DEPOSIT_PENDING" ||
        application.status === "OFFER_ISSUED" ||
        application.status === "PROVISIONALLY_ACCEPTED"
          ? "DEPOSIT_PAID"
          : application.status,
    },
  });

  await logAudit({
    schoolId: application.schoolId,
    userId: params.actorId,
    action: "UPDATE",
    entity: "Application",
    entityId: application.id,
    metadata: {
      kind: "DEPOSIT_PAID",
      source: params.source,
      paymentId: params.paymentId,
      depositInvoiceId: application.depositInvoiceId,
    },
  });

  return updated;
}

/** Sync application when its deposit invoice is paid through the finance ledger. */
export async function syncDepositApplicationsForInvoice(params: {
  invoiceId: string;
  actorId: string;
}): Promise<void> {
  const apps = await prisma.application.findMany({
    where: { depositInvoiceId: params.invoiceId, depositPaidAt: null, depositWaivedAt: null },
  });
  for (const app of apps) {
    await markApplicationDepositPaid({
      applicationId: app.id,
      actorId: params.actorId,
      source: "finance_payment",
    });
  }
}
