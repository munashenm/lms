import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSchoolPermission } from "@/lib/gate/access";
import { gatePolicySchema } from "@/lib/gate/schema";
import { DEFAULT_DEPARTURE, DEFAULT_DUPLICATE_SECONDS, DEFAULT_SCHOOL_START } from "@/lib/gate/engine";

export async function GET() {
  const auth = await requireSchoolPermission("gate:manage");
  if ("error" in auth) return auth.error;
  const policy = await prisma.gatePolicy.findUnique({ where: { schoolId: auth.schoolId } });
  return NextResponse.json({
    policy: policy ?? {
      schoolStartTime: DEFAULT_SCHOOL_START,
      lateAfterMinutes: 0,
      normalDepartureTime: DEFAULT_DEPARTURE,
      duplicateScanIntervalSeconds: DEFAULT_DUPLICATE_SECONDS,
      requireVisitorIdentity: false,
      allowVisitorPhoto: true,
      saved: false,
    },
    saved: Boolean(policy),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:manage");
  if ("error" in auth) return auth.error;
  const parsed = gatePolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const policy = await prisma.gatePolicy.upsert({
    where: { schoolId: auth.schoolId },
    create: { schoolId: auth.schoolId, ...parsed.data },
    update: parsed.data,
  });
  await logAudit({
    schoolId: auth.schoolId,
    userId: auth.session.userId,
    action: "GATE_POLICY_UPDATED",
    entity: "GatePolicy",
    entityId: policy.id,
  });
  return NextResponse.json({ policy, saved: true });
}
