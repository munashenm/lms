import {
  BillingFrequency,
  FeeChargeSource,
  InstalmentStatus,
  InvoiceStatus,
  StudentLedgerType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { calculateInvoiceTotals, generateInvoiceNumber } from "./finance";
import {
  chargeIdempotencyKey,
  feeStructureApplies,
  planInstalments,
  type EnrolmentFeeContext,
} from "./fee-matching";
import { createStudentLedgerEntry } from "./student-ledger";
import { logAudit } from "./audit";
import { chargeOutstanding, unpaidInstalmentIds } from "./charge-reversal";

export async function applyEnrolmentFees(params: {
  studentId: string;
  schoolId: string;
  academicYearId: string;
  enrolmentId?: string | null;
  courseId?: string | null;
  gradeId?: string | null;
  classId?: string | null;
  campusId?: string | null;
  moduleIds?: string[];
  hostel?: boolean;
  transport?: boolean;
  recordedById?: string | null;
}): Promise<{ charged: number; skipped: number }> {
  const [student, year, school] = await Promise.all([
    prisma.student.findFirst({
      where: { id: params.studentId, schoolId: params.schoolId },
      include: { grade: { select: { name: true } }, class: { select: { name: true } } },
    }),
    prisma.academicYear.findFirst({
      where: { id: params.academicYearId, schoolId: params.schoolId },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    }),
    prisma.school.findUnique({ where: { id: params.schoolId }, select: { id: true } }),
  ]);
  if (!student || !year || !school) return { charged: 0, skipped: 0 };

  const currentTerm = year.terms.find((t) => t.isCurrent) ?? year.terms[0] ?? null;
  const ctx: EnrolmentFeeContext = {
    schoolId: params.schoolId,
    academicYearId: year.id,
    termId: currentTerm?.id ?? null,
    campusId: params.campusId ?? student.campusId,
    gradeId: params.gradeId ?? student.gradeId,
    classId: params.classId ?? student.classId,
    courseId: params.courseId ?? null,
    qualification: null,
    moduleIds: params.moduleIds ?? [],
    hostel: params.hostel,
    transport: params.transport,
    startDate: new Date(),
    yearStart: year.startDate,
    yearEnd: year.endDate,
    termCount: year.terms.length || 4,
  };

  const fees = await prisma.feeStructure.findMany({
    where: { schoolId: params.schoolId, isActive: true, applyOnEnrolment: true },
  });
  const applicable = fees.filter((fee) => feeStructureApplies(fee, ctx));

  let charged = 0;
  let skipped = 0;

  for (const fee of applicable) {
    const key = chargeIdempotencyKey(student.id, fee.id, year.id);
    const existing = await prisma.studentCharge.findUnique({ where: { idempotencyKey: key } });
    if (existing && !existing.reversedAt) {
      skipped += 1;
      continue;
    }

    const custom = Array.isArray(fee.customScheduleJson)
      ? (fee.customScheduleJson as Array<{ dueDate?: string; amount?: number; dueOffsetDays?: number }>)
      : null;
    const instalments = planInstalments({
      amount: Number(fee.amount),
      frequency: fee.billingFrequency,
      allowInstalments: fee.allowInstalments,
      instalmentCount: fee.instalmentCount,
      customSchedule: custom,
      startDate: ctx.startDate,
      yearStart: ctx.yearStart,
      dueDayOfMonth: fee.dueDayOfMonth,
      termCount: ctx.termCount,
    });
    const firstDue = instalments[0]?.dueDate ?? ctx.startDate;

    const invoiceNumber = await generateInvoiceNumber(params.schoolId, () =>
      prisma.invoice.count({ where: { schoolId: params.schoolId } })
    );
    const { subtotal, total } = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: Number(fee.amount) }],
      0
    );

    const invoice = await prisma.invoice.create({
      data: {
        schoolId: params.schoolId,
        studentId: student.id,
        invoiceNumber,
        description: fee.name,
        subtotal,
        discount: 0,
        total,
        status: InvoiceStatus.SENT,
        dueDate: firstDue,
        lineItems: {
          create: [
            {
              description: fee.name,
              quantity: 1,
              unitPrice: Number(fee.amount),
              amount: Number(fee.amount),
            },
          ],
        },
      },
    });

    const charge = await prisma.studentCharge.create({
      data: {
        schoolId: params.schoolId,
        studentId: student.id,
        enrolmentId: params.enrolmentId ?? null,
        feeStructureId: fee.id,
        academicYearId: year.id,
        invoiceId: invoice.id,
        source: fee.chargeSource,
        description: fee.name,
        amount: fee.amount,
        idempotencyKey: existing ? `${key}:r${Date.now()}` : key,
        instalments: {
          create: instalments.map((row) => ({
            sequence: row.sequence,
            dueDate: row.dueDate,
            amount: row.amount,
          })),
        },
      },
    });

    await createStudentLedgerEntry({
      schoolId: params.schoolId,
      studentId: student.id,
      academicYearId: year.id,
      type: StudentLedgerType.CHARGE,
      description: fee.name,
      amount: Number(fee.amount),
      reference: invoiceNumber,
      invoiceId: invoice.id,
      recordedById: params.recordedById,
      chargeSource: fee.chargeSource,
      studentChargeId: charge.id,
    });

    await logAudit({
      schoolId: params.schoolId,
      userId: params.recordedById,
      action: "STUDENT_CHARGED",
      entity: "StudentCharge",
      entityId: charge.id,
      metadata: { source: fee.chargeSource, feeStructureId: fee.id, invoiceNumber },
    });
    charged += 1;
  }

  return { charged, skipped };
}

export async function syncEnrolmentModules(enrolmentId: string, moduleIds: string[]) {
  const unique = Array.from(new Set(moduleIds.filter(Boolean)));
  await prisma.enrolmentModule.deleteMany({
    where: { enrolmentId, moduleId: { notIn: unique.length ? unique : ["__none__"] } },
  });
  for (const moduleId of unique) {
    await prisma.enrolmentModule.upsert({
      where: { enrolmentId_moduleId: { enrolmentId, moduleId } },
      update: {},
      create: { enrolmentId, moduleId },
    });
  }
}

export async function createManualStudentCharge(params: {
  schoolId: string;
  studentId: string;
  academicYearId?: string | null;
  feeStructureId?: string | null;
  source?: FeeChargeSource;
  description: string;
  amount: number;
  dueDate?: Date | null;
  allowInstalments?: boolean;
  instalmentCount?: number | null;
  frequency?: BillingFrequency;
  customSchedule?: Array<{ dueDate?: string; amount?: number; dueOffsetDays?: number }> | null;
  dueDayOfMonth?: number | null;
  recordedById?: string | null;
}) {
  let key =
    params.feeStructureId && params.academicYearId
      ? chargeIdempotencyKey(params.studentId, params.feeStructureId, params.academicYearId)
      : `manual:${params.studentId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  if (params.feeStructureId && params.academicYearId) {
    const existing = await prisma.studentCharge.findUnique({
      where: { idempotencyKey: key },
      include: { invoice: true, instalments: true },
    });
    if (existing && !existing.reversedAt) {
      return { charge: existing, invoice: existing.invoice, skipped: true as const };
    }
    if (existing?.reversedAt) key = `${key}:r${Date.now()}`;
  }

  const invoiceNumber = await generateInvoiceNumber(params.schoolId, () =>
    prisma.invoice.count({ where: { schoolId: params.schoolId } })
  );
  const { subtotal, total } = calculateInvoiceTotals(
    [{ quantity: 1, unitPrice: params.amount }],
    0
  );
  const startDate = params.dueDate ?? new Date();
  const planned = planInstalments({
    amount: params.amount,
    frequency: params.frequency ?? BillingFrequency.ONCE,
    allowInstalments: Boolean(params.allowInstalments || (params.instalmentCount ?? 1) > 1),
    instalmentCount: params.instalmentCount,
    customSchedule: params.customSchedule,
    startDate,
    yearStart: startDate,
    dueDayOfMonth: params.dueDayOfMonth,
  });
  const invoice = await prisma.invoice.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      invoiceNumber,
      description: params.description,
      subtotal,
      discount: 0,
      total,
      status: InvoiceStatus.SENT,
      dueDate: planned[0]?.dueDate ?? startDate,
      lineItems: {
        create: [
          {
            description: params.description,
            quantity: 1,
            unitPrice: params.amount,
            amount: params.amount,
          },
        ],
      },
    },
  });

  const charge = await prisma.studentCharge.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      academicYearId: params.academicYearId ?? null,
      invoiceId: invoice.id,
      source: params.source ?? FeeChargeSource.MANUAL_CHARGE,
      description: params.description,
      amount: params.amount,
      idempotencyKey: key,
      feeStructureId: params.feeStructureId ?? null,
      instalments: {
        create: planned.map((row) => ({
          sequence: row.sequence,
          dueDate: row.dueDate,
          amount: row.amount,
        })),
      },
    },
  });

  await createStudentLedgerEntry({
    schoolId: params.schoolId,
    studentId: params.studentId,
    academicYearId: params.academicYearId,
    type: StudentLedgerType.CHARGE,
    description: params.description,
    amount: params.amount,
    reference: invoiceNumber,
    invoiceId: invoice.id,
    recordedById: params.recordedById,
    chargeSource: params.source ?? FeeChargeSource.MANUAL_CHARGE,
    studentChargeId: charge.id,
  });

  return { charge, invoice, skipped: false as const };
}

export async function reverseStudentCharge(params: {
  schoolId: string;
  chargeId: string;
  recordedById: string;
  reason?: string | null;
}): Promise<
  | { ok: true; outstanding: number }
  | { ok: false; error: "not_found" | "already_reversed" | "nothing_to_reverse" }
> {
  const charge = await prisma.studentCharge.findFirst({
    where: { id: params.chargeId, schoolId: params.schoolId },
    include: {
      instalments: true,
      invoice: true,
      ledgerEntries: { where: { type: StudentLedgerType.CHARGE }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!charge) return { ok: false, error: "not_found" };
  if (charge.reversedAt) return { ok: false, error: "already_reversed" };

  const outstanding = chargeOutstanding(
    Number(charge.amount),
    charge.instalments.map((row) => ({ amountPaid: Number(row.amountPaid) }))
  );
  if (outstanding <= 0) return { ok: false, error: "nothing_to_reverse" };

  await prisma.studentCharge.update({
    where: { id: charge.id },
    data: { reversedAt: new Date() },
  });

  const cancelIds = unpaidInstalmentIds(
    charge.instalments.map((row) => ({ id: row.id, amountPaid: Number(row.amountPaid) }))
  );
  if (cancelIds.length) {
    await prisma.chargeInstalment.updateMany({
      where: { id: { in: cancelIds } },
      data: { status: InstalmentStatus.CANCELLED },
    });
  }

  const original = charge.ledgerEntries[0] ?? null;
  await createStudentLedgerEntry({
    schoolId: charge.schoolId,
    studentId: charge.studentId,
    academicYearId: charge.academicYearId,
    type: StudentLedgerType.CREDIT,
    description: params.reason
      ? `Reversal of charge: ${charge.description} (${params.reason})`
      : `Reversal of charge: ${charge.description}`,
    amount: outstanding,
    reference: charge.invoice?.invoiceNumber ?? null,
    invoiceId: charge.invoiceId,
    recordedById: params.recordedById,
    chargeSource: charge.source,
    studentChargeId: charge.id,
    reversesEntryId: original?.id ?? null,
  });

  if (charge.invoice && Number(charge.invoice.amountPaid) <= 0) {
    await prisma.invoice.update({
      where: { id: charge.invoice.id },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }

  return { ok: true, outstanding };
}

export type StudentChargeCreate = Prisma.StudentChargeGetPayload<{
  include: { instalments: true };
}>;
