import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getOutstandingBalance } from "@/lib/finance";

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

  if (!invoice) {
    return { error: NextResponse.json({ message: "Invoice not found" }, { status: 404 }) };
  }

  if (session.role === "STUDENT") {
    const student = await prisma.student.findFirst({ where: { userId: session.userId } });
    if (!student || invoice.studentId !== student.id) {
      return { error: NextResponse.json({ message: "Unauthorized" }, { status: 403 }) };
    }
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
