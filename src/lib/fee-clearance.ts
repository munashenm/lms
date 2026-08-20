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

export type DocumentRelease = {
  released: boolean;
  outstandingCents: number;
  requireFees: boolean;
};

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

export function documentReleaseFrom(requireFees: boolean, outstandingCents: number): DocumentRelease {
  return {
    requireFees,
    outstandingCents,
    released: !requireFees || outstandingCents === 0,
  };
}

export async function getStudentOutstandingCents(studentId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { studentId, status: { in: COLLECTABLE } },
    select: { total: true, amountPaid: true },
  });
  return outstandingCentsFromInvoices(invoices);
}

export async function getDocumentReleases(
  studentIds: string[]
): Promise<Map<string, DocumentRelease>> {
  const result = new Map<string, DocumentRelease>();
  if (!studentIds.length) return result;

  const [students, invoices] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, school: { select: { requireFeesPaidForDocuments: true } } },
    }),
    prisma.invoice.findMany({
      where: { studentId: { in: studentIds }, status: { in: COLLECTABLE } },
      select: { studentId: true, total: true, amountPaid: true },
    }),
  ]);

  const outstandingByStudent = new Map<string, number>();
  for (const invoice of invoices) {
    outstandingByStudent.set(
      invoice.studentId,
      (outstandingByStudent.get(invoice.studentId) ?? 0) +
        toCents(outstandingOf(String(invoice.total), String(invoice.amountPaid)))
    );
  }

  for (const student of students) {
    result.set(
      student.id,
      documentReleaseFrom(
        student.school.requireFeesPaidForDocuments,
        outstandingByStudent.get(student.id) ?? 0
      )
    );
  }
  return result;
}

export async function getDocumentRelease(studentId: string): Promise<DocumentRelease> {
  const releases = await getDocumentReleases([studentId]);
  return releases.get(studentId) ?? documentReleaseFrom(true, 0);
}

export function summarizeDocumentReleases(
  studentIds: string[],
  releases: Map<string, DocumentRelease>
) {
  const rows = studentIds.map((id) => ({
    id,
    ...(releases.get(id) ?? documentReleaseFrom(true, 0)),
  }));
  return {
    releasedIds: rows.filter((row) => row.released).map((row) => row.id),
    blocked: rows.find((row) => !row.released),
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
