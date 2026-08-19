import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, hasPermission } from "@/lib/rbac";
import { getOutstandingBalance } from "@/lib/finance";
import { getChildStudentIds } from "@/lib/portal-data";

export function canInitiateInvoicePayment(input: {
  role: UserRole;
  invoiceStudentId: string;
  invoiceSchoolId: string;
  sessionSchoolId: string | null;
  sessionUserId: string;
  studentUserId: string | null;
  childStudentIds: string[];
}): boolean {
  if (input.role === UserRole.SUPER_ADMIN) return true;
  if (input.sessionSchoolId && input.sessionSchoolId !== input.invoiceSchoolId) return false;
  if (input.role === UserRole.STUDENT) {
    return Boolean(input.studentUserId && input.studentUserId === input.sessionUserId);
  }
  if (input.role === UserRole.PARENT) {
    return input.childStudentIds.includes(input.invoiceStudentId);
  }
  return (
    hasPermission(input.role, "finance.payments.create") ||
    hasPermission(input.role, "finance:write")
  );
}

export async function authorizeInvoiceForPayment(invoiceId: string | undefined) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  if (!invoiceId) {
    return { error: NextResponse.json({ message: "invoiceId required" }, { status: 400 }) };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      student: {
        select: { firstName: true, lastName: true, email: true, userId: true },
      },
    },
  });

  if (!invoice || !canAccessSchool(session, invoice.schoolId)) {
    return { error: NextResponse.json({ message: "Invoice not found" }, { status: 404 }) };
  }

  const childStudentIds =
    session.role === UserRole.PARENT ? await getChildStudentIds(session) : [];

  if (
    !canInitiateInvoicePayment({
      role: session.role,
      invoiceStudentId: invoice.studentId,
      invoiceSchoolId: invoice.schoolId,
      sessionSchoolId: session.schoolId,
      sessionUserId: session.userId,
      studentUserId: invoice.student.userId,
      childStudentIds,
    })
  ) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 403 }) };
  }

  const outstanding = getOutstandingBalance(
    Number(invoice.total),
    Number(invoice.amountPaid)
  );

  if (outstanding <= 0) {
    return {
      error: NextResponse.json({ message: "Invoice already paid" }, { status: 400 }),
    };
  }

  return { invoice, outstanding, session };
}
