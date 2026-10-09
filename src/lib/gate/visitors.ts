import { GateDirection, GateEventOutcome, GatePersonType, GateScanMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { formatVisitorReference, visitorPersonKey, zonedParts } from "./engine";

export async function allocateVisitorReference(schoolId: string, now = new Date()): Promise<string> {
  const year = zonedParts(now).year;
  const rows = await prisma.$queryRaw<Array<{ lastNumber: number }>>`
    INSERT INTO visitor_reference_counters ("schoolId", "year", "lastNumber")
    VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT ("schoolId", "year")
    DO UPDATE SET "lastNumber" = visitor_reference_counters."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const sequence = Number(rows[0]?.lastNumber ?? 1);
  return formatVisitorReference(year, sequence);
}

export async function recordVisitorGate(input: {
  schoolId: string;
  visitorId: string;
  recordedById: string;
  direction: "IN" | "OUT" | "DENIED";
  now?: Date;
  notes?: string | null;
}) {
  const now = input.now ?? new Date();
  const outcome = input.direction === "DENIED" ? GateEventOutcome.DENIED : input.direction === "OUT" ? GateEventOutcome.RECORDED : GateEventOutcome.RECORDED;
  const direction = input.direction === "OUT" ? GateDirection.OUT : GateDirection.IN;
  const event = await prisma.gateEvent.create({
    data: {
      schoolId: input.schoolId,
      personType: GatePersonType.VISITOR,
      personKey: visitorPersonKey(input.visitorId),
      visitorEntryId: input.visitorId,
      direction,
      method: GateScanMethod.MANUAL,
      scannedAt: now,
      recordedById: input.recordedById,
      outcome,
      denialCode: input.direction === "DENIED" ? "VISITOR_DENIED" : null,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });
  await logAudit({
    schoolId: input.schoolId,
    userId: input.recordedById,
    action: input.direction === "IN" ? "VISITOR_CHECKED_IN" : input.direction === "OUT" ? "VISITOR_CHECKED_OUT" : "VISITOR_DENIED",
    entity: "VisitorEntry",
    entityId: input.visitorId,
    metadata: { gateEventId: event.id },
  });
  return event;
}
