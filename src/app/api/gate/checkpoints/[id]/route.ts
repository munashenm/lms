import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSchoolPermission } from "@/lib/gate/access";
import { gateCheckpointSchema } from "@/lib/gate/schema";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireSchoolPermission("gate:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.gateCheckpoint.findFirst({ where: { id, schoolId: auth.schoolId } });
  if (!existing) return NextResponse.json({ message: "Checkpoint not found" }, { status: 404 });
  const parsed = gateCheckpointSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const gate = await prisma.gateCheckpoint.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.code != null ? { code: parsed.data.code.trim().toUpperCase() } : {}),
      ...(parsed.data.location !== undefined ? { location: parsed.data.location?.trim() || null } : {}),
      ...(parsed.data.deviceId !== undefined ? { deviceId: parsed.data.deviceId?.trim() || null } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });
  await logAudit({
    schoolId: auth.schoolId,
    userId: auth.session.userId,
    action: "GATE_CHECKPOINT_UPDATED",
    entity: "GateCheckpoint",
    entityId: gate.id,
  });
  return NextResponse.json({ gate });
}
