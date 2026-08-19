import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { accrueSchoolLeaveEntitlements } from "@/lib/leave-entitlement";

export async function POST() {
  const session = await getSession();
  if (!requirePermission(session, "hr.leave.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const summary = await accrueSchoolLeaveEntitlements({ schoolId });
  return NextResponse.json({ summary });
}
