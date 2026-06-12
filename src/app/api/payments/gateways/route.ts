import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAvailablePaymentGateways } from "@/lib/payment-gateways";
import { getResolvedIntegrations, resolveSessionSchoolId } from "@/lib/school-integrations";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const schoolId = await resolveSessionSchoolId(session);
  const integrations = await getResolvedIntegrations(schoolId);

  return NextResponse.json({ gateways: getAvailablePaymentGateways(integrations) });
}
