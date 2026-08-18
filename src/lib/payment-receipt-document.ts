import { CommunicationCategory } from "@prisma/client";
import { prisma } from "./db";
import { PAYMENT_METHOD_LABELS, getOutstandingBalance } from "./finance";
import { generatePaymentReceiptPdf } from "./pdf-payment-receipt";
import { toSchoolBrand } from "./pdf-branding";
import { formatDate, formatZAR } from "./utils";
import { sendLoggedEmail } from "./communications";
import { logAudit } from "./audit";
import { getFeeEmailRecipient } from "./fee-recipient";

export function formatReceiptNumber(paymentId: string, paidAt: Date): string {
  return `RCP-${paidAt.getFullYear()}-${paymentId.slice(-8).toUpperCase()}`;
}

export async function loadPaymentReceiptDocument(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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

  if (!payment) return null;

  const invoice = payment.invoice;
  const amount = Number(payment.amount);
  const invoiceTotal = Number(invoice.total);
  const invoiceAmountPaid = Number(invoice.amountPaid);
  const outstanding = getOutstandingBalance(invoiceTotal, invoiceAmountPaid);
  const receiptNo = formatReceiptNumber(payment.id, payment.paidAt);

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
  });

  const filename = `receipt-${receiptNo}.pdf`;
  return { payment, invoice, pdf, filename, receiptNo, amount, outstanding };
}

export async function emailPaymentReceipt(params: {
  paymentId: string;
  userId: string;
  toEmail?: string | null;
}) {
  const doc = await loadPaymentReceiptDocument(params.paymentId);
  if (!doc) {
    return { ok: false as const, httpStatus: 404, message: "Payment not found" };
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
  const subject = `Payment Receipt ${doc.receiptNo} – ${studentName}`;
  const message = `Dear ${recipientName},

Please find attached a payment receipt for ${studentName}.

Amount received: ${formatZAR(doc.amount)}
Invoice: ${doc.invoice.invoiceNumber}
Receipt: ${doc.receiptNo}
Outstanding on this invoice: ${
    doc.outstanding > 0 ? formatZAR(doc.outstanding) : "Paid in full"
  }

Kind regards,
${doc.invoice.school.name} Accounts Department`;

  const log = await sendLoggedEmail({
    schoolId: doc.invoice.schoolId,
    studentId: doc.invoice.studentId,
    category: CommunicationCategory.FEE_RECEIPT,
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
      paymentId: doc.payment.id,
      invoiceId: doc.invoice.id,
      receiptNo: doc.receiptNo,
      amount: doc.amount,
    },
  });

  await logAudit({
    schoolId: doc.invoice.schoolId,
    userId: params.userId,
    action: "CREATE",
    entity: "FeeReceiptEmail",
    entityId: doc.payment.id,
    metadata: { channel: "email", to: toEmail, status: log.status },
  });

  return {
    ok: true as const,
    status: log.status,
    message:
      log.status === "SENT"
        ? "Receipt email sent"
        : log.error || "Receipt logged (email provider not ready)",
  };
}
