import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getChildStudentIds, getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { PAYMENT_METHOD_LABELS, getOutstandingBalance } from "@/lib/finance";
import { generatePaymentReceiptPdf } from "@/lib/pdf-payment-receipt";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { amountInWordsZar } from "@/lib/amount-in-words";
import { formatDate } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          school: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentNumber: true,
              grade: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const invoice = payment.invoice;
  let allowed = false;

  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    allowed = student?.id === invoice.studentId;
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    allowed = childIds.includes(invoice.studentId);
  } else if (requirePermission(session, "finance:read")) {
    const filter = getSchoolFilter(session);
    allowed =
      !("schoolId" in filter) || filter.schoolId === invoice.schoolId;
  }

  if (!allowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const amount = Number(payment.amount);
  const invoiceTotal = Number(invoice.total);
  const invoiceAmountPaid = Number(invoice.amountPaid);
  const outstanding = getOutstandingBalance(invoiceTotal, invoiceAmountPaid);
  const receiptNo = payment.receiptNumber;
  const recordedBy = payment.recordedById
    ? await prisma.user.findUnique({
        where: { id: payment.recordedById },
        select: { firstName: true, lastName: true },
      })
    : null;

  const pdf = await generatePaymentReceiptPdf({
    brand: toSchoolBrand(invoice.school),
    receiptNo,
    studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
    studentNumber: invoice.student.studentNumber,
    gradeOrProgramme: [invoice.student.grade?.name, invoice.student.class?.name]
      .filter(Boolean)
      .join(" / "),
    invoiceNumber: invoice.invoiceNumber,
    amount,
    methodLabel: PAYMENT_METHOD_LABELS[payment.method],
    reference: payment.reference,
    notes: payment.notes,
    paidAt: formatDate(payment.paidAt),
    invoiceTotal,
    invoiceAmountPaid,
    outstanding,
    amountInWords: amountInWordsZar(amount),
    receivedBy: recordedBy ? `${recordedBy.firstName} ${recordedBy.lastName}` : null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receiptNo}.pdf"`,
    },
  });
}
