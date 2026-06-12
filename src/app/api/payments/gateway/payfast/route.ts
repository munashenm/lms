import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createPayFastPayment, isPayFastConfigured } from "@/lib/payment-gateways/payfast";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";
import { getResolvedIntegrations } from "@/lib/school-integrations";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  const integrations = await getResolvedIntegrations(auth.invoice.schoolId);

  if (!isPayFastConfigured(integrations)) {
    return NextResponse.json({
      configured: false,
      message: "PayFast is not enabled. Configure it under Admin → Settings → Integrations.",
    });
  }

  const result = createPayFastPayment(integrations, {
    invoiceId: auth.invoice.id,
    invoiceNumber: auth.invoice.invoiceNumber,
    amount: auth.outstanding,
    studentEmail: auth.invoice.student.email ?? undefined,
    studentName: `${auth.invoice.student.firstName} ${auth.invoice.student.lastName}`,
  });

  return NextResponse.json(result);
}
