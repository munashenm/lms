import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { reverseStudentCharge } from "@/lib/fee-engine";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  reason: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (
    !hasPermission(session.role, "finance.fees.manage") &&
    !hasPermission(session.role, "finance:write") &&
    !hasPermission(session.role, "finance.payments.reverse")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const result = await reverseStudentCharge({
    schoolId,
    chargeId: id,
    recordedById: session.userId,
    reason: parsed.success ? parsed.data.reason : null,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    const message =
      result.error === "already_reversed"
        ? "Charge already reversed"
        : result.error === "nothing_to_reverse"
          ? "Nothing left to reverse. Reverse payments if the charge is fully paid."
          : "Charge not found";
    return NextResponse.json({ message }, { status });
  }
  await logAudit({
    schoolId,
    userId: session.userId,
    action: "STUDENT_CHARGE_REVERSED",
    entity: "StudentCharge",
    entityId: id,
    metadata: { outstanding: result.outstanding },
  });
  return NextResponse.json(result);
}
