import { CommunicationCategory, InvoiceStatus } from "@prisma/client";
import { prisma } from "./db";
import { getOutstandingBalance, INVOICE_STATUS_LABELS } from "./finance";
import { generateInvoicePdf, type InvoicePdfData } from "./pdf-invoice";
import { toSchoolBrand, type SchoolBrand } from "./pdf-branding";
import { formatDate, formatZAR } from "./utils";
import { sendLoggedEmail } from "./communications";
import { logAudit } from "./audit";
import { getFeeEmailRecipient } from "./fee-recipient";

const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const invoiceInclude = {
  school: true,
  lineItems: { orderBy: { createdAt: "asc" as const } },
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
} as const;

export function toInvoicePdfData(
  invoice: {
    invoiceNumber: string;
    status: InvoiceStatus;
    description: string | null;
    subtotal: { toString(): string } | number;
    discount: { toString(): string } | number;
    total: { toString(): string } | number;
    amountPaid: { toString(): string } | number;
    issuedAt: Date;
    dueDate: Date | null;
    lineItems: {
      description: string;
      quantity: number;
      unitPrice: { toString(): string } | number;
      amount: { toString(): string } | number;
    }[];
    student: {
      firstName: string;
      lastName: string;
      studentNumber: string;
      grade?: { name: string } | null;
      class?: { name: string } | null;
    };
    school: Parameters<typeof toSchoolBrand>[0];
  }
): InvoicePdfData {
  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amountPaid);

  return {
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
  };
}

export async function loadInvoiceDocument(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });
  if (!invoice) return null;

  const data = toInvoicePdfData(invoice);
  const pdf = await generateInvoicePdf(data);
  const filename = `invoice-${invoice.invoiceNumber}.pdf`;

  return { invoice, data, pdf, filename };
}

export async function buildOutstandingInvoiceAttachments(
  studentId: string,
  brand: SchoolBrand,
  limit = 4
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      studentId,
      status: { in: OUTSTANDING_STATUSES },
    },
    include: invoiceInclude,
    orderBy: [{ dueDate: "asc" }, { issuedAt: "asc" }],
    take: limit,
  });

  const attachments: { filename: string; type: string; contentBase64: string }[] =
    [];

  for (const invoice of invoices) {
    const data = toInvoicePdfData(invoice);
    const pdf = await generateInvoicePdf({ ...data, brand });
    attachments.push({
      filename: `invoice-${invoice.invoiceNumber}.pdf`,
      type: "application/pdf",
      contentBase64: Buffer.from(pdf).toString("base64"),
    });
  }

  return attachments;
}

export async function emailInvoiceDocument(params: {
  invoiceId: string;
  userId: string;
  toEmail?: string | null;
}) {
  const doc = await loadInvoiceDocument(params.invoiceId);
  if (!doc) {
    return { ok: false as const, httpStatus: 404, message: "Invoice not found" };
  }

  if (doc.invoice.status === InvoiceStatus.DRAFT) {
    return {
      ok: false as const,
      httpStatus: 400,
      message: "Draft invoices cannot be emailed",
    };
  }

  if (doc.invoice.status === InvoiceStatus.CANCELLED) {
    return {
      ok: false as const,
      httpStatus: 400,
      message: "Cancelled invoices cannot be emailed",
    };
  }

  const recipient = await getFeeEmailRecipient(doc.invoice.studentId);
  const toEmail = params.toEmail || recipient?.toEmail;
  if (!toEmail) {
    return {
      ok: false as const,
      httpStatus: 400,
      message: "No guardian/student email on file",
    };
  }

  const studentName = `${doc.invoice.student.firstName} ${doc.invoice.student.lastName}`;
  const recipientName = recipient?.recipientName ?? "Parent/Guardian";
  const outstanding = formatZAR(doc.data.outstanding);
  const subject = `Fee Invoice ${doc.invoice.invoiceNumber} – ${studentName}`;
  const message = `Dear ${recipientName},

Please find attached invoice ${doc.invoice.invoiceNumber} for ${studentName}.

Invoice total: ${formatZAR(doc.data.total)}
Amount paid: ${formatZAR(doc.data.amountPaid)}
Outstanding: ${doc.data.outstanding > 0 ? outstanding : "Paid in full"}
${doc.invoice.dueDate ? `Due date: ${formatDate(doc.invoice.dueDate)}` : ""}

Please contact the accounts department should you require assistance.

Kind regards,
${doc.invoice.school.name} Accounts Department`;

  const log = await sendLoggedEmail({
    schoolId: doc.invoice.schoolId,
    studentId: doc.invoice.studentId,
    category: CommunicationCategory.FEE_INVOICE,
    recipientName,
    recipientContact: toEmail,
    subject,
    message,
    attachments: [
      {
        filename: doc.filename,
        type: "application/pdf",
        contentBase64: Buffer.from(doc.pdf).toString("base64"),
      },
    ],
    metadata: {
      invoiceId: doc.invoice.id,
      invoiceNumber: doc.invoice.invoiceNumber,
      outstanding: doc.data.outstanding,
    },
  });

  await logAudit({
    schoolId: doc.invoice.schoolId,
    userId: params.userId,
    action: "CREATE",
    entity: "FeeInvoiceEmail",
    entityId: doc.invoice.id,
    metadata: { channel: "email", to: toEmail, status: log.status },
  });

  return {
    ok: true as const,
    status: log.status,
    message:
      log.status === "SENT"
        ? "Invoice email sent"
        : log.error || "Invoice logged (email provider not ready)",
  };
}
