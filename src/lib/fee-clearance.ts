import { InvoiceStatus, UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";
import { prisma } from "./db";
import { outstandingOf, toCents, fromCents } from "./money";
import { getChildStudentIds, getStudentForSession } from "./portal-data";

const COLLECTABLE: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

export function isLearnerPortalRole(role: UserRole): boolean {
  return role === UserRole.STUDENT || role === UserRole.PARENT;
}

export function outstandingCentsFromInvoices(
  invoices: Array<{ total: unknown; amountPaid: unknown }>
): number {
  return invoices.reduce(
    (sum, invoice) => sum + toCents(outstandingOf(String(invoice.total), String(invoice.amountPaid))),
    0
  );
}

export async function getStudentOutstandingCents(studentId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { studentId, status: { in: COLLECTABLE } },
    select: { total: true, amountPaid: true },
  });
  return outstandingCentsFromInvoices(invoices);
}

export async function getDocumentRelease(studentId: string): Promise<{
  released: boolean;
  outstandingCents: number;
  requireFees: boolean;
}> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { school: { select: { requireFeesPaidForDocuments: true } } },
  });
  const requireFees = student?.school.requireFeesPaidForDocuments ?? true;
  const outstandingCents = await getStudentOutstandingCents(studentId);
  return {
    requireFees,
    outstandingCents,
    released: !requireFees || outstandingCents === 0,
  };
}

export function feesHoldMessage(outstandingCents: number): string {
  const amount = fromCents(outstandingCents).toFixed(2);
  return `School fees of R${amount} are still outstanding. Reports, certificates and letters are released when the account is paid in full.`;
}

export async function authorizeAcademicDocument(opts: {
  session: SessionPayload | null;
  studentId: string;
  schoolId: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { session, studentId, schoolId } = opts;
  if (!session) return { ok: false, status: 401, message: "Unauthorized" };

  // Learners also have marks:read — never treat STUDENT/PARENT as staff for the fee hold.
  if (!isLearnerPortalRole(session.role)) {
    if (session.role !== UserRole.SUPER_ADMIN && session.schoolId && session.schoolId !== schoolId) {
      return { ok: false, status: 403, message: "Unauthorized" };
    }
    return { ok: true };
  }

  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    if (!student || student.id !== studentId) {
      return { ok: false, status: 403, message: "Unauthorized" };
    }
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (!childIds.includes(studentId)) {
      return { ok: false, status: 403, message: "Unauthorized" };
    }
  } else {
    return { ok: false, status: 403, message: "Unauthorized" };
  }

  const release = await getDocumentRelease(studentId);
  if (!release.released) {
    return { ok: false, status: 403, message: feesHoldMessage(release.outstandingCents) };
  }
  return { ok: true };
}
