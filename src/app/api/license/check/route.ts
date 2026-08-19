import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { checkLicenseWithServer, maybeHeartbeat } from "@/lib/licensing/service";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "license.manage") && !requirePermission(session, "license.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { schoolId?: string; force?: boolean };
  const schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const evaluation = body.force
    ? await checkLicenseWithServer(schoolId, "manual")
    : await maybeHeartbeat(schoolId);
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "LICENSE_CHECKED",
    entity: "License",
    metadata: { status: evaluation.effectiveStatus, force: Boolean(body.force) },
  });
  return NextResponse.json({ evaluation });
}
