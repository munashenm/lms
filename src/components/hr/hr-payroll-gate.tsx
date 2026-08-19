import { getSession } from "@/lib/auth";
import { getPortalSessionContext } from "@/lib/portal-session";
import { isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

export async function hrPayrollGate() {
  const session = await getSession();
  if (!session) return <PortalUnavailable moduleName="HR & Payroll" />;
  const ctx = await getPortalSessionContext(session);
  if (!isFeatureEnabled(ctx.license, "hr_payroll")) {
    return <PortalUnavailable moduleName="HR & Payroll" />;
  }
  return null;
}
