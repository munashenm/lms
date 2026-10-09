import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSchoolPermission } from "@/lib/gate/access";
import { gateCheckpointSchema } from "@/lib/gate/schema";

export async function GET() {
  const auth = await requireSchoolPermission("gate:read");
  if ("error" in auth) return auth.error;
  const gates = await prisma.gateCheckpoint.findMany({
    where: { schoolId: auth.schoolId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ gates });
}

export async function POST(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:manage");
  if ("error" in auth) return auth.error;
  const parsed = gateCheckpointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const code = parsed.data.code.trim().toUpperCase();
  const existing = await prisma.gateCheckpoint.findFirst({
    where: { schoolId: auth.schoolId, code },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ message: "A checkpoint with that code already exists" }, { status: 409 });
  const gate = await prisma.gateCheckpoint.create({
    data: {
      schoolId: auth.schoolId,
      name: parsed.data.name.trim(),
      code,
      location: parsed.data.location?.trim() || null,
      deviceId: parsed.data.deviceId?.trim() || null,
      isActive: parsed.data.isActive ?? true,
    },
  });
  await logAudit({
    schoolId: auth.schoolId,
    userId: auth.session.userId,
    action: "GATE_CHECKPOINT_CREATED",
    entity: "GateCheckpoint",
    entityId: gate.id,
  });
  return NextResponse.json({ gate }, { status: 201 });
}
