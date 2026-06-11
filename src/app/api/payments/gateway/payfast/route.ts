import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createPayFastPayment, isPayFastConfigured } from "@/lib/payment-gateways/payfast";
import { getOutstandingBalance } from "@/lib/finance";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await request.json();
  if (!invoiceId) {
    return NextResponse.json({ message: "invoiceId required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { firstName: true, lastName: true, email: true, userId: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
  }

  if (session.role === "STUDENT") {
    const student = await prisma.student.findFirst({ where: { userId: session.userId } });
    if (!student || invoice.studentId !== student.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const outstanding = getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid));
  if (outstanding <= 0) {
    return NextResponse.json({ message: "Invoice already paid" }, { status: 400 });
  }

  if (!isPayFastConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "PayFast is not configured. Set PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE in .env",
      sandboxHint: "Use sandbox credentials from payfast.co.za for testing",
    });
  }

  const result = createPayFastPayment({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: outstanding,
    studentEmail: invoice.student.email ?? undefined,
    studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
  });

  return NextResponse.json(result);
}
