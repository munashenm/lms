import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, LedgerEntryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";
import { z } from "zod";

const schema = z.object({
  supplierId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  financialAccountId: z.string().optional().nullable(),
  description: z.string().min(1),
  invoiceRef: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  vatAmount: z.coerce.number().min(0).optional(),
  transactionDate: z.string().min(1),
  paymentDate: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  post: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const expenses = await prisma.expense.findMany({
    where: getSchoolFilter(session!),
    include: { supplier: true, category: true, financialAccount: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });
  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.expenses.manage") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  await ensureFinanceCatalog(schoolId);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const post = Boolean(parsed.data.post);
  const expense = await prisma.expense.create({
    data: {
      schoolId,
      supplierId: parsed.data.supplierId ?? null,
      categoryId: parsed.data.categoryId ?? null,
      financialAccountId: parsed.data.financialAccountId ?? null,
      description: parsed.data.description,
      invoiceRef: parsed.data.invoiceRef ?? null,
      amount: parsed.data.amount,
      vatAmount: parsed.data.vatAmount ?? 0,
      transactionDate: new Date(parsed.data.transactionDate),
      paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : null,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      approvalStatus: post ? ApprovalStatus.POSTED : ApprovalStatus.DRAFT,
      createdById: session!.userId,
      postedAt: post ? new Date() : null,
    },
  });

  if (post) {
    const category = expense.categoryId
      ? await prisma.expenseCategory.findUnique({ where: { id: expense.categoryId } })
      : null;
    await prisma.ledgerEntry.create({
      data: {
        schoolId,
        type: LedgerEntryType.EXPENSE,
        category: category?.name ?? "Other",
        description: expense.description,
        amount: expense.amount,
        vatAmount: expense.vatAmount,
        reference: expense.invoiceRef,
        entryDate: expense.transactionDate,
        recordedById: session!.userId,
        supplierId: expense.supplierId,
        financialAccountId: expense.financialAccountId,
        expenseId: expense.id,
        attachmentUrl: expense.attachmentUrl,
      },
    });
  }

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "EXPENSE_CREATED",
    entity: "Expense",
    entityId: expense.id,
    metadata: { amount: parsed.data.amount, posted: post },
  });
  return NextResponse.json({ expense }, { status: 201 });
}
