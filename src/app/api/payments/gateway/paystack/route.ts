import { NextRequest, NextResponse } from "next/server";
import { createPaystackPayment, isPaystackConfigured } from "@/lib/payment-gateways/paystack";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";
import { getResolvedIntegrations } from "@/lib/school-integrations";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  const integrations = await getResolvedIntegrations(auth.invoice.schoolId);

  if (!isPaystackConfigured(integrations)) {
    return NextResponse.json({
      configured: false,
      message: "Paystack is not enabled. Configure it under Admin → Settings → Integrations.",
    });
  }

  const result = await createPaystackPayment(integrations, {
    invoiceId: auth.invoice.id,
    invoiceNumber: auth.invoice.invoiceNumber,
    amount: auth.outstanding,
    studentEmail: auth.invoice.student.email ?? undefined,
    studentName: `${auth.invoice.student.firstName} ${auth.invoice.student.lastName}`,
    role: auth.session.role,
  });

  return NextResponse.json(result);
}
