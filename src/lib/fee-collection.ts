import type { InvoiceStatus, Prisma } from "@prisma/client";
import { getOutstandingBalance, isCollectedPayment } from "./finance";
import { maskIdentityNumber } from "./learner-portal";
import {
  formatSchoolAddress,
  formatSchoolContactLine,
  type SchoolBrand,
} from "./pdf-branding";

export const FEE_COLLECTION_MIN_QUERY = 2;

export const COLLECTABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  "SENT",
  "PARTIALLY_PAID",
  "OVERDUE",
];

export function isCollectableInvoiceStatus(status: InvoiceStatus): boolean {
  return COLLECTABLE_INVOICE_STATUSES.includes(status);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function feeCollectionSearchWhere(params: {
  schoolId?: string;
  query: string;
  classId?: string;
  studentId?: string;
}): Prisma.StudentWhereInput | null {
  const query = params.query.trim();
  const classId = params.classId?.trim() || undefined;
  const studentId = params.studentId?.trim() || undefined;

  if (studentId) {
    return {
      id: studentId,
      status: { not: "WITHDRAWN" },
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    };
  }

  if (query.length < FEE_COLLECTION_MIN_QUERY && !classId) return null;

  const where: Prisma.StudentWhereInput = {
    status: { in: ["ACTIVE", "SUSPENDED"] },
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(classId ? { classId } : {}),
  };

  if (query.length >= FEE_COLLECTION_MIN_QUERY) {
    const digits = digitsOnly(query);
    const parts = query.split(/\s+/).filter((part) => /[A-Za-z]/.test(part));
    const or: Prisma.StudentWhereInput[] = [
      { studentNumber: { contains: query, mode: "insensitive" } },
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { class: { is: { name: { contains: query, mode: "insensitive" } } } },
      { grade: { is: { name: { contains: query, mode: "insensitive" } } } },
    ];
    if (digits.length >= 4) {
      or.push({ saIdNumber: { contains: digits } });
    }
    if (query !== digits && query.length >= 4) {
      or.push({ saIdNumber: { contains: query, mode: "insensitive" } });
    }
    if (parts.length >= 2) {
      or.push({
        AND: [
          { firstName: { contains: parts[0], mode: "insensitive" } },
          { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
        ],
      });
    }
    where.OR = or;
  }

  return where;
}

export type FeeCollectionInvoice = {
  id: string;
  invoiceNumber: string;
  description: string | null;
  status: InvoiceStatus;
  total: number;
  amountPaid: number;
  outstanding: number;
  dueDate: Date | string | null;
  issuedAt: Date | string;
};

export function mapFeeCollectionInvoice(invoice: {
  id: string;
  invoiceNumber: string;
  description: string | null;
  status: InvoiceStatus;
  total: { toString(): string } | number | string;
  amountPaid: { toString(): string } | number | string;
  dueDate: Date | string | null;
  issuedAt: Date | string;
}): FeeCollectionInvoice {
  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amountPaid);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    description: invoice.description,
    status: invoice.status,
    total,
    amountPaid,
    outstanding: getOutstandingBalance(total, amountPaid),
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
  };
}

export type PublicFeeCollectionStudent = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  identityNumber: string | null;
  grade: string | null;
  className: string | null;
  classId: string | null;
  outstandingTotal: number;
  invoices: FeeCollectionInvoice[];
};

export function toPublicFeeCollectionStudent(student: {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  saIdNumber: string | null;
  classId: string | null;
  grade: { name: string } | null;
  class: { name: string } | null;
  invoices: Array<Parameters<typeof mapFeeCollectionInvoice>[0]>;
}): PublicFeeCollectionStudent {
  const invoices = student.invoices
    .map(mapFeeCollectionInvoice)
    .filter((invoice) => invoice.outstanding > 0 && isCollectableInvoiceStatus(invoice.status));
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    identityNumber: maskIdentityNumber(student.saIdNumber),
    grade: student.grade?.name ?? null,
    className: student.class?.name ?? null,
    classId: student.classId,
    outstandingTotal: invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0),
    invoices,
  };
}

/** Parse a collection timestamp. Naive values are treated as Africa/Johannesburg. */
export function parseCollectionPaidAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return null;
  const seconds = match[4] ?? "00";
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3]}:${seconds}+02:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertPaidAtAcceptable(paidAt: Date, now = new Date()): string | null {
  if (paidAt.getTime() > now.getTime() + 10 * 60 * 1000) {
    return "Collection date and time cannot be in the future";
  }
  if (paidAt.getTime() < Date.parse("1990-01-01T00:00:00+02:00")) {
    return "Collection date is too far in the past";
  }
  return null;
}

export function invoiceSchoolDetailLines(brand: SchoolBrand): string[] {
  return [
    brand.name,
    formatSchoolAddress(brand),
    formatSchoolContactLine(brand),
    brand.registrationNo ? `Registration: ${brand.registrationNo}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function collectedPaymentsForInvoice<T extends {
  reversedAt?: Date | string | null;
  reversalOfId?: string | null;
}>(payments: T[]): T[] {
  return payments.filter((payment) => isCollectedPayment(payment));
}
