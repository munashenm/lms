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
  employeeId?: string | null;
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
    let userId = input.userId ?? null;
    let employeeId = input.employeeId ?? null;
    if (employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, schoolId: input.schoolId },
        select: { id: true, userId: true, status: true },
      });
      if (!employee || employee.status === "TERMINATED") return { ok: false, message: "Staff member not found" };
      employeeId = employee.id;
      userId = employee.userId ?? userId;
    } else if (userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, schoolId: input.schoolId, role: { notIn: [UserRole.STUDENT, UserRole.PARENT] } },
        select: { id: true, employee: { select: { id: true } } },
      });
      if (!user) return { ok: false, message: "Staff member not found" };
      userId = user.id;
      employeeId = user.employee?.id ?? null;
    } else {
      return { ok: false, message: "Staff member not found" };
    }
    const token = generateCardToken();
    const card = await prisma.$transaction(async (tx) => {
      const replaced = await tx.accessCard.updateMany({
        where: {
          schoolId: input.schoolId,
          status: AccessCardStatus.ACTIVE,
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(employeeId ? [{ employeeId }] : []),
          ],
        },
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
          userId,
          employeeId,
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

const ACTIVE_CARD = { none: { status: AccessCardStatus.ACTIVE } } as const;

export async function missingCardCounts(schoolId: string): Promise<{ learners: number; staff: number }> {
  const [learners, staff] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE", accessCards: ACTIVE_CARD } }),
    prisma.employee.count({ where: { schoolId, status: "ACTIVE", accessCards: ACTIVE_CARD } }),
  ]);
  return { learners, staff };
}

/** Issues opaque cards for people who do not yet have an active one. Learner numbers are never used as credentials. */
export async function issueMissingAccessCards(input: {
  schoolId: string;
  actorId: string;
  holderType: "STUDENT" | "STAFF";
  limit: number;
}): Promise<{ issued: number; remaining: number; cardIds: string[] }> {
  const take = Math.min(200, Math.max(1, Math.trunc(input.limit)));
  const cardIds: string[] = [];
  if (input.holderType === "STUDENT") {
    const rows = await prisma.student.findMany({
      where: { schoolId: input.schoolId, status: "ACTIVE", accessCards: ACTIVE_CARD },
      select: { id: true },
      orderBy: { studentNumber: "asc" },
      take,
    });
    for (const row of rows) {
      const issued = await issueAccessCard({
        schoolId: input.schoolId,
        actorId: input.actorId,
        holderType: "STUDENT",
        studentId: row.id,
        reason: "Bulk issue",
      });
      if (issued.ok) cardIds.push(issued.cardId);
    }
  } else {
    const rows = await prisma.employee.findMany({
      where: { schoolId: input.schoolId, status: "ACTIVE", accessCards: ACTIVE_CARD },
      select: { id: true },
      orderBy: { employeeNumber: "asc" },
      take,
    });
    for (const row of rows) {
      const issued = await issueAccessCard({
        schoolId: input.schoolId,
        actorId: input.actorId,
        holderType: "STAFF",
        employeeId: row.id,
        reason: "Bulk issue",
      });
      if (issued.ok) cardIds.push(issued.cardId);
    }
  }
  const counts = await missingCardCounts(input.schoolId);
  return {
    issued: cardIds.length,
    remaining: input.holderType === "STUDENT" ? counts.learners : counts.staff,
    cardIds,
  };
}
