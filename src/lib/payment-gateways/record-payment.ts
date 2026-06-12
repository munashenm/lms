import { PaymentMethod, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { deriveInvoiceStatus } from "../finance";
import { notifyUser, notifySchoolRoles } from "../notifications";

interface RecordGatewayPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export async function recordGatewayPayment(params: RecordGatewayPaymentParams) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      student: { select: { userId: true, firstName: true, lastName: true } },
    },
  });

  if (!invoice) {
    return { ok: false as const, reason: "invoice_not_found" };
  }

  const existing = await prisma.payment.findFirst({
    where: { reference: params.reference, invoiceId: params.invoiceId },
  });
  if (existing) {
    return { ok: true as const, duplicate: true };
  }

  const newAmountPaid = Number(invoice.amountPaid) + params.amount;
  const total = Number(invoice.total);

  await prisma.payment.create({
    data: {
      invoiceId: params.invoiceId,
      amount: params.amount,
      method: params.method,
      reference: params.reference,
      notes: params.notes,
    },
  });

  const newStatus = deriveInvoiceStatus(
    total,
    newAmountPaid,
    invoice.dueDate,
    invoice.status
  );

  await prisma.invoice.update({
    where: { id: params.invoiceId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  const methodLabel = params.method.replace("_", " ");

  if (invoice.student.userId) {
    await notifyUser({
      userId: invoice.student.userId,
      schoolId: invoice.schoolId,
      title: "Payment received",
      message: `Your payment of R${params.amount.toFixed(2)} for ${invoice.invoiceNumber} was successful.`,
      type: "FEE",
      link: `/student/fees/${params.invoiceId}`,
    });
  }

  await notifySchoolRoles({
    schoolId: invoice.schoolId,
    roles: [UserRole.FINANCE_OFFICER, UserRole.SCHOOL_ADMIN],
    title: `${methodLabel} payment`,
    message: `${invoice.student.firstName} ${invoice.student.lastName} paid R${params.amount.toFixed(2)} via ${methodLabel}.`,
    type: "FEE",
    link: `/finance/invoices/${params.invoiceId}`,
  });

  return { ok: true as const, duplicate: false };
}
