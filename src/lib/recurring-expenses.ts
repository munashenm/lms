import { ApprovalStatus } from "@prisma/client";
import { prisma } from "./db";
import { advanceRecurringDate } from "./recurring-schedule";

export { advanceRecurringDate } from "./recurring-schedule";

export async function generateOneRecurringExpense(params: {
  recurringExpenseId: string;
  schoolId: string;
  actorId?: string | null;
  requireActive?: boolean;
}) {
  const rec = await prisma.recurringExpense.findFirst({
    where: {
      id: params.recurringExpenseId,
      schoolId: params.schoolId,
      ...(params.requireActive ? { isActive: true } : {}),
    },
  });
  if (!rec) return { ok: false as const, reason: "not_found" as const };

  const already = await prisma.expense.findFirst({
    where: {
      recurringExpenseId: rec.id,
      transactionDate: rec.nextDueDate,
    },
    select: { id: true },
  });
  if (already) {
    await prisma.recurringExpense.update({
      where: { id: rec.id },
      data: { nextDueDate: advanceRecurringDate(rec.nextDueDate, rec.interval) },
    });
    return { ok: true as const, skipped: true, expenseId: already.id };
  }

  const expense = await prisma.expense.create({
    data: {
      schoolId: rec.schoolId,
      supplierId: rec.supplierId,
      categoryId: rec.categoryId,
      financialAccountId: rec.financialAccountId,
      recurringExpenseId: rec.id,
      description: rec.description,
      amount: rec.amount,
      transactionDate: rec.nextDueDate,
      approvalStatus: rec.requireConfirm ? ApprovalStatus.DRAFT : ApprovalStatus.PENDING,
      createdById: params.actorId ?? null,
    },
  });
  await prisma.recurringExpense.update({
    where: { id: rec.id },
    data: { nextDueDate: advanceRecurringDate(rec.nextDueDate, rec.interval) },
  });
  return { ok: true as const, skipped: false, expenseId: expense.id };
}

export async function generateDueRecurringExpenses(params?: {
  schoolId?: string;
  asOf?: Date;
  actorId?: string | null;
}) {
  const asOf = params?.asOf ?? new Date();
  const due = await prisma.recurringExpense.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: asOf },
      ...(params?.schoolId ? { schoolId: params.schoolId } : {}),
    },
  });

  const generated: string[] = [];
  for (const rec of due) {
    const result = await generateOneRecurringExpense({
      recurringExpenseId: rec.id,
      schoolId: rec.schoolId,
      actorId: params?.actorId,
      requireActive: true,
    });
    if (result.ok && !result.skipped) generated.push(result.expenseId);
  }

  return { scanned: due.length, generated: generated.length, expenseIds: generated };
}
