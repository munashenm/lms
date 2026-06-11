import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deriveInvoiceStatus } from "@/lib/finance";
import { notifyUser, notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";

/** PayFast ITN webhook — records payment when gateway confirms */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const paymentStatus = formData.get("payment_status")?.toString();
  const invoiceId = formData.get("m_payment_id")?.toString();
  const amount = parseFloat(formData.get("amount_gross")?.toString() ?? "0");
  const pfPaymentId = formData.get("pf_payment_id")?.toString();

  if (!invoiceId || paymentStatus !== "COMPLETE" || amount <= 0) {
    return NextResponse.json({ received: true });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { userId: true, firstName: true, lastName: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  const existing = await prisma.payment.findFirst({
    where: { reference: pfPaymentId ?? undefined, invoiceId },
  });
  if (existing) {
    return NextResponse.json({ received: true });
  }

  const newAmountPaid = Number(invoice.amountPaid) + amount;
  const total = Number(invoice.total);

  await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      method: "PAYFAST",
      reference: pfPaymentId ?? `PF-${Date.now()}`,
      notes: "PayFast ITN",
    },
  });

  const newStatus = deriveInvoiceStatus(total, newAmountPaid, invoice.dueDate, invoice.status);
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  if (invoice.student.userId) {
    await notifyUser({
      userId: invoice.student.userId,
      schoolId: invoice.schoolId,
      title: "Payment received",
      message: `Your payment of R${amount.toFixed(2)} for ${invoice.invoiceNumber} was successful.`,
      type: "FEE",
      link: `/student/fees/${invoiceId}`,
    });
  }

  await notifySchoolRoles({
    schoolId: invoice.schoolId,
    roles: [UserRole.FINANCE_OFFICER, UserRole.SCHOOL_ADMIN],
    title: "PayFast payment",
    message: `${invoice.student.firstName} ${invoice.student.lastName} paid R${amount.toFixed(2)} via PayFast.`,
    type: "FEE",
    link: `/finance/invoices/${invoiceId}`,
  });

  return NextResponse.json({ received: true });
}
