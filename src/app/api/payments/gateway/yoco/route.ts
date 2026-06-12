import { NextRequest, NextResponse } from "next/server";
import { createYocoCheckout, isYocoConfigured } from "@/lib/payment-gateways/yoco";
import { authorizeInvoiceForPayment } from "@/lib/payment-gateways/invoice-auth";
import { getResolvedIntegrations } from "@/lib/school-integrations";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  const auth = await authorizeInvoiceForPayment(invoiceId);
  if ("error" in auth) return auth.error;

  const integrations = await getResolvedIntegrations(auth.invoice.schoolId);

  if (!isYocoConfigured(integrations)) {
    return NextResponse.json({
      configured: false,
      message: "Yoco is not enabled. Configure it under Admin → Settings → Integrations.",
    });
  }

  try {
    const result = await createYocoCheckout(integrations, {
      invoiceId: auth.invoice.id,
      invoiceNumber: auth.invoice.invoiceNumber,
      amount: auth.outstanding,
      studentEmail: auth.invoice.student.email ?? undefined,
      studentName: `${auth.invoice.student.firstName} ${auth.invoice.student.lastName}`,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[yoco] checkout failed", err);
    return NextResponse.json(
      { message: "Could not create Yoco checkout session" },
      { status: 502 }
    );
  }
}
