import { NextRequest, NextResponse } from "next/server";
import { RecurringInterval, ApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { z } from "zod";

const schema = z.object({
  supplierId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  financialAccountId: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  interval: z.nativeEnum(RecurringInterval).default(RecurringInterval.MONTHLY),
  nextDueDate: z.string().min(1),
  requireConfirm: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const items = await prisma.recurringExpense.findMany({
    where: getSchoolFilter(session!),
    include: { supplier: true, category: true },
    orderBy: { nextDueDate: "asc" },
  });
  return NextResponse.json({ recurringExpenses: items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.expenses.manage") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const body = await request.json();
  if (body.generateId) {
    const rec = await prisma.recurringExpense.findFirst({
      where: { id: body.generateId, schoolId },
    });
    if (!rec) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const expense = await prisma.expense.create({
      data: {
        schoolId,
        supplierId: rec.supplierId,
        categoryId: rec.categoryId,
        financialAccountId: rec.financialAccountId,
        recurringExpenseId: rec.id,
        description: rec.description,
        amount: rec.amount,
        transactionDate: rec.nextDueDate,
        approvalStatus: rec.requireConfirm ? ApprovalStatus.DRAFT : ApprovalStatus.PENDING,
        createdById: session!.userId,
      },
    });
    const next = new Date(rec.nextDueDate);
    if (rec.interval === RecurringInterval.YEARLY) next.setUTCFullYear(next.getUTCFullYear() + 1);
    else if (rec.interval === RecurringInterval.QUARTERLY) next.setUTCMonth(next.getUTCMonth() + 3);
    else if (rec.interval === RecurringInterval.HALF_YEARLY) next.setUTCMonth(next.getUTCMonth() + 6);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    await prisma.recurringExpense.update({ where: { id: rec.id }, data: { nextDueDate: next } });
    return NextResponse.json({ expense }, { status: 201 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const item = await prisma.recurringExpense.create({
    data: {
      schoolId,
      ...parsed.data,
      nextDueDate: new Date(parsed.data.nextDueDate),
    },
  });
  return NextResponse.json({ recurringExpense: item }, { status: 201 });
}
