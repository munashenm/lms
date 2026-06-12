import { NextRequest, NextResponse } from "next/server";
import { createOzowPayment, isOzowConfigured } from "@/lib/payment-gateways/ozow";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";
import { getResolvedIntegrations } from "@/lib/school-integrations";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  const integrations = await getResolvedIntegrations(auth.invoice.schoolId);

  if (!isOzowConfigured(integrations)) {
    return NextResponse.json({
      configured: false,
      message: "Ozow is not enabled. Configure it under Admin → Settings → Integrations.",
    });
  }

  const result = createOzowPayment(integrations, {
    invoiceId: auth.invoice.id,
    invoiceNumber: auth.invoice.invoiceNumber,
    amount: auth.outstanding,
  });

  return NextResponse.json(result);
}
