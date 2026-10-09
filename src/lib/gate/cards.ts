import { AccessCardHolder, AccessCardStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateCardToken } from "./engine";

export async function issueAccessCard(input: {
  schoolId: string;
  actorId: string;
  holderType: "STUDENT" | "STAFF";
  studentId?: string | null;
  userId?: string | null;
  reason?: string | null;
}): Promise<{ ok: true; cardId: string; token: string } | { ok: false; message: string }> {
  if (input.holderType === "STUDENT") {
    if (!input.studentId) return { ok: false, message: "Learner not found" };
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, schoolId: input.schoolId },
      select: { id: true },
    });
    if (!student) return { ok: false, message: "Learner not found" };
  } else {
    if (!input.userId) return { ok: false, message: "Staff member not found" };
    const user = await prisma.user.findFirst({
      where: { id: input.userId, schoolId: input.schoolId, role: { notIn: [UserRole.STUDENT, UserRole.PARENT] } },
      select: { id: true, employee: { select: { id: true } } },
    });
    if (!user) return { ok: false, message: "Staff member not found" };
    const token = generateCardToken();
    const card = await prisma.$transaction(async (tx) => {
      const replaced = await tx.accessCard.updateMany({
        where: { schoolId: input.schoolId, userId: user.id, status: AccessCardStatus.ACTIVE },
        data: {
          status: AccessCardStatus.REPLACED,
          deactivatedAt: new Date(),
          deactivatedById: input.actorId,
          deactivationReason: input.reason?.trim() || "Replaced",
        },
      });
      const created = await tx.accessCard.create({
        data: {
          schoolId: input.schoolId,
          holderType: AccessCardHolder.STAFF,
          userId: user.id,
          employeeId: user.employee?.id ?? null,
          token,
          status: AccessCardStatus.ACTIVE,
          issuedById: input.actorId,
        },
        select: { id: true },
      });
      return { ...created, replaced: replaced.count };
    });
    await logAudit({
      schoolId: input.schoolId,
      userId: input.actorId,
      action: card.replaced > 0 ? "CARD_REPLACED" : "CARD_ISSUED",
      entity: "AccessCard",
      entityId: card.id,
      metadata: { holderType: "STAFF" },
    });
    return { ok: true, cardId: card.id, token };
  }

  const token = generateCardToken();
  const card = await prisma.$transaction(async (tx) => {
    const replaced = await tx.accessCard.updateMany({
      where: { schoolId: input.schoolId, studentId: input.studentId!, status: AccessCardStatus.ACTIVE },
      data: {
        status: AccessCardStatus.REPLACED,
        deactivatedAt: new Date(),
        deactivatedById: input.actorId,
        deactivationReason: input.reason?.trim() || "Replaced",
      },
    });
    const created = await tx.accessCard.create({
      data: {
        schoolId: input.schoolId,
        holderType: AccessCardHolder.STUDENT,
        studentId: input.studentId!,
        token,
        status: AccessCardStatus.ACTIVE,
        issuedById: input.actorId,
      },
      select: { id: true },
    });
    return { ...created, replaced: replaced.count };
  });
  await logAudit({
    schoolId: input.schoolId,
    userId: input.actorId,
    action: card.replaced > 0 ? "CARD_REPLACED" : "CARD_ISSUED",
    entity: "AccessCard",
    entityId: card.id,
    metadata: { holderType: "STUDENT" },
  });
  return { ok: true, cardId: card.id, token };
}

export async function deactivateAccessCard(input: {
  schoolId: string;
  actorId: string;
  cardId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const card = await prisma.accessCard.findFirst({
    where: { id: input.cardId, schoolId: input.schoolId },
    select: { id: true, status: true },
  });
  if (!card) return { ok: false, message: "Card not found" };
  if (card.status !== AccessCardStatus.ACTIVE) return { ok: false, message: "Card is already inactive" };
  await prisma.accessCard.update({
    where: { id: card.id },
    data: {
      status: AccessCardStatus.DEACTIVATED,
      deactivatedAt: new Date(),
      deactivatedById: input.actorId,
      deactivationReason: input.reason.trim() || "Deactivated",
    },
  });
  await logAudit({
    schoolId: input.schoolId,
    userId: input.actorId,
    action: "CARD_DEACTIVATED",
    entity: "AccessCard",
    entityId: card.id,
  });
  return { ok: true };
}
