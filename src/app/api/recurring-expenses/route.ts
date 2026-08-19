import { NextRequest, NextResponse } from "next/server";
import { RecurringInterval } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { generateDueRecurringExpenses, generateOneRecurringExpense } from "@/lib/recurring-expenses";
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
  if (body.generateDue) {
    const summary = await generateDueRecurringExpenses({ schoolId, actorId: session!.userId });
    return NextResponse.json({ summary }, { status: 201 });
  }
  if (body.generateId) {
    const result = await generateOneRecurringExpense({
      recurringExpenseId: body.generateId,
      schoolId,
      actorId: session!.userId,
    });
    if (!result.ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ expenseId: result.expenseId, skipped: result.skipped }, { status: 201 });
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
