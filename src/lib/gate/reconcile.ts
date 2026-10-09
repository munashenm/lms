import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { visitorPersonKey } from "./engine";
import { openVisitors, splitOpenPresence } from "./queries";

/**
 * Records that an unresolved IN was reviewed. The original gate event and visitor
 * sign-in stay unchanged, and no OUT scan is created.
 */
export async function reconcileMissingCheckout(input: {
  schoolId: string;
  actorId: string;
  gateEventId?: string | null;
  visitorEntryId?: string | null;
  reason: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, message: "A reason is required" };
  const now = new Date();

  if (input.gateEventId) {
    const presence = await splitOpenPresence(input.schoolId, now);
    const row = presence.missing.find((item) => item.id === input.gateEventId);
    if (!row) return { ok: false, message: "This entry is not an unresolved checkout for this school" };
    try {
      await prisma.gateCheckoutReconciliation.create({
        data: {
          schoolId: input.schoolId,
          gateEventId: row.id,
          personKey: row.personKey,
          reason,
          reconciledById: input.actorId,
        },
      });
    } catch {
      return { ok: false, message: "This checkout was already reconciled" };
    }
    await logAudit({
      schoolId: input.schoolId,
      userId: input.actorId,
      action: "GATE_MISSING_OUT_RECONCILED",
      entity: "GateEvent",
      entityId: row.id,
      metadata: { reason, personKey: row.personKey },
    });
    return { ok: true };
  }

  if (input.visitorEntryId) {
    const visitors = await openVisitors(input.schoolId, now);
    const row = visitors.missing.find((item) => item.id === input.visitorEntryId);
    if (!row) return { ok: false, message: "This visitor is not an unresolved checkout for this school" };
    await prisma.gateCheckoutReconciliation.create({
      data: {
        schoolId: input.schoolId,
        visitorEntryId: row.id,
        personKey: visitorPersonKey(row.id),
        reason,
        reconciledById: input.actorId,
      },
    });
    await logAudit({
      schoolId: input.schoolId,
      userId: input.actorId,
      action: "GATE_MISSING_OUT_RECONCILED",
      entity: "VisitorEntry",
      entityId: row.id,
      metadata: { reason },
    });
    return { ok: true };
  }

  return { ok: false, message: "Choose a missing checkout" };
}
