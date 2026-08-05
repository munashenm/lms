import { StudentLedgerType, type Prisma } from "@prisma/client";
import { prisma } from "./db";

export const STUDENT_LEDGER_TYPE_LABELS: Record<StudentLedgerType, string> = {
  CHARGE: "Charge",
  PAYMENT: "Payment",
  CREDIT: "Credit",
  DISCOUNT: "Discount",
  BURSARY: "Bursary",
  SPONSORSHIP: "Sponsorship",
  ADJUSTMENT: "Adjustment",
  REFUND: "Refund",
};

/** Positive types increase the amount owed. */
export function signedAmountForType(type: StudentLedgerType, amount: number): number {
  const abs = Math.abs(amount);
  switch (type) {
    case StudentLedgerType.CHARGE:
    case StudentLedgerType.ADJUSTMENT:
      return abs;
    case StudentLedgerType.PAYMENT:
    case StudentLedgerType.CREDIT:
    case StudentLedgerType.DISCOUNT:
    case StudentLedgerType.BURSARY:
    case StudentLedgerType.SPONSORSHIP:
    case StudentLedgerType.REFUND:
      return -abs;
  }
}

export async function createStudentLedgerEntry(params: {
  schoolId: string;
  studentId: string;
  academicYearId?: string | null;
  type: StudentLedgerType;
  description: string;
  amount: number;
  reference?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  entryDate?: Date;
  recordedById?: string | null;
  notes?: string | null;
  signedAmount?: number;
}) {
  const signedAmount =
    params.signedAmount ?? signedAmountForType(params.type, params.amount);

  return prisma.studentLedgerEntry.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      academicYearId: params.academicYearId ?? null,
      type: params.type,
      description: params.description,
      signedAmount,
      reference: params.reference ?? null,
      invoiceId: params.invoiceId ?? null,
      paymentId: params.paymentId ?? null,
      entryDate: params.entryDate ?? new Date(),
      recordedById: params.recordedById ?? null,
      notes: params.notes ?? null,
    },
  });
}

export async function getStudentLedgerBalance(studentId: string): Promise<number> {
  const agg = await prisma.studentLedgerEntry.aggregate({
    where: { studentId },
    _sum: { signedAmount: true },
  });
  return Number(agg._sum.signedAmount ?? 0);
}

export async function getStudentLedger(params: {
  studentId: string;
  academicYearId?: string | null;
  take?: number;
}) {
  const where: Prisma.StudentLedgerEntryWhereInput = {
    studentId: params.studentId,
    ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
  };

  const [entries, balanceAgg, student] = await Promise.all([
    prisma.studentLedgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: params.take ?? 100,
      include: {
        academicYear: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        payment: { select: { id: true, method: true, reference: true } },
      },
    }),
    prisma.studentLedgerEntry.aggregate({
      where,
      _sum: { signedAmount: true },
    }),
    prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        email: true,
        grade: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
  ]);

  return {
    student,
    balance: Number(balanceAgg._sum.signedAmount ?? 0),
    entries: entries.map((e) => ({
      ...e,
      signedAmount: Number(e.signedAmount),
    })),
  };
}

export async function postInvoiceToStudentLedger(params: {
  schoolId: string;
  studentId: string;
  invoiceId: string;
  invoiceNumber: string;
  description?: string | null;
  total: number;
  discount?: number;
  recordedById?: string | null;
}) {
  const existing = await prisma.studentLedgerEntry.findFirst({
    where: { invoiceId: params.invoiceId, type: StudentLedgerType.CHARGE },
  });
  if (existing) return existing;

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId: params.schoolId, isCurrent: true },
    select: { id: true },
  });

  if (params.discount && params.discount > 0) {
    await createStudentLedgerEntry({
      schoolId: params.schoolId,
      studentId: params.studentId,
      academicYearId: currentYear?.id,
      type: StudentLedgerType.DISCOUNT,
      description: `Discount on ${params.invoiceNumber}`,
      amount: params.discount,
      invoiceId: params.invoiceId,
      recordedById: params.recordedById,
    });
  }

  return createStudentLedgerEntry({
    schoolId: params.schoolId,
    studentId: params.studentId,
    academicYearId: currentYear?.id,
    type: StudentLedgerType.CHARGE,
    description: params.description || `Invoice ${params.invoiceNumber}`,
    amount: params.total + (params.discount ?? 0),
    reference: params.invoiceNumber,
    invoiceId: params.invoiceId,
    recordedById: params.recordedById,
  });
}

export async function postPaymentToStudentLedger(params: {
  schoolId: string;
  studentId: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  reference?: string | null;
  recordedById?: string | null;
}) {
  const existing = await prisma.studentLedgerEntry.findFirst({
    where: { paymentId: params.paymentId, type: StudentLedgerType.PAYMENT },
  });
  if (existing) return existing;

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId: params.schoolId, isCurrent: true },
    select: { id: true },
  });

  return createStudentLedgerEntry({
    schoolId: params.schoolId,
    studentId: params.studentId,
    academicYearId: currentYear?.id,
    type: StudentLedgerType.PAYMENT,
    description: `Payment for ${params.invoiceNumber} (${params.method})`,
    amount: params.amount,
    reference: params.reference,
    invoiceId: params.invoiceId,
    paymentId: params.paymentId,
    recordedById: params.recordedById,
  });
}
