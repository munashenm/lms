import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getChildStudentIds, getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import {
  INVOICE_STATUS_LABELS,
  getOutstandingBalance,
} from "@/lib/finance";
import { generateInvoicePdf } from "@/lib/pdf-invoice";
import { toSchoolBrand } from "@/lib/pdf-branding";
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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      school: true,
      lineItems: { orderBy: { createdAt: "asc" } },
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
  });

  if (!invoice) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

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

  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amountPaid);

  const pdf = await generateInvoicePdf({
    brand: toSchoolBrand(invoice.school),
    invoiceNumber: invoice.invoiceNumber,
    statusLabel: INVOICE_STATUS_LABELS[invoice.status],
    description: invoice.description,
    studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
    studentNumber: invoice.student.studentNumber,
    gradeOrProgramme: [invoice.student.grade?.name, invoice.student.class?.name]
      .filter(Boolean)
      .join(" / "),
    issuedAt: formatDate(invoice.issuedAt),
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : null,
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    total,
    amountPaid,
    outstanding: getOutstandingBalance(total, amountPaid),
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
