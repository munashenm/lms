import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { asInputJson } from "@/lib/json";
import { containsBiometricPayload } from "@/lib/gate/engine";
import { gateScanSchema } from "@/lib/gate/schema";
import { performGateScan } from "@/lib/gate/service";
import { createPrismaGateStore } from "@/lib/gate/prisma-store";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  if (containsBiometricPayload(raw)) {
    return NextResponse.json({
      ok: false,
      code: "ACCESS_DENIED",
      title: "ACCESS DENIED",
      detail: "Biometric capture is not enabled.",
      person: null,
    }, { status: 400 });
  }

  const parsed = gateScanSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const permission = parsed.data.method === "MANUAL" ? "gate:manual" : "gate:scan";
  if (!requirePermission(session, permission)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (parsed.data.correction && !requirePermission(session, "gate:manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const outcome = await performGateScan(createPrismaGateStore(), {
    schoolId: session.schoolId,
    recordedById: session.userId,
    recordedByName: `${session.firstName} ${session.lastName}`.trim(),
    direction: parsed.data.direction,
    method: parsed.data.method,
    token: parsed.data.token,
    personType: parsed.data.personType,
    personId: parsed.data.personId,
    gateId: parsed.data.gateId,
    deviceId: parsed.data.deviceId,
    notes: parsed.data.notes,
    manualReason: parsed.data.manualReason,
    earlyDepartureReason: parsed.data.earlyDepartureReason,
    earlyDepartureNote: parsed.data.earlyDepartureNote,
    bypassDuplicate: parsed.data.correction === true,
    rawBody: raw,
  });

  await logAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: outcome.audit.action,
    entity: outcome.audit.entity,
    entityId: outcome.audit.entityId,
    metadata: asInputJson(outcome.audit.metadata),
  });

  return NextResponse.json(outcome.result, { status: outcome.result.ok ? 200 : outcome.result.code === "INVALID" ? 400 : 200 });
}
