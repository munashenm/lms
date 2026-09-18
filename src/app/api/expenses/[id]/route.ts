import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, LedgerEntryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireStaffPermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { scopedId } from "@/lib/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  action: z.enum(["post", "approve"]),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requireStaffPermission(session, "finance.expenses.manage") && !requireStaffPermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const expense = await prisma.expense.findFirst({ where: scopedId(session!, id), include: { category: true } });
  if (!expense) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(expense.schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  if (parsed.data.action === "approve") {
    if (!requireStaffPermission(session, "finance.expenses.approve") && !requireStaffPermission(session, "finance.expenses.manage") && !requireStaffPermission(session, "finance:write")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const updated = await prisma.expense.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });
    return NextResponse.json({ expense: updated });
  }

  if (expense.postedAt) {
    return NextResponse.json({ message: "Expense already posted" }, { status: 400 });
  }
  const updated = await prisma.expense.update({
    where: { id },
    data: { approvalStatus: ApprovalStatus.POSTED, postedAt: new Date() },
  });
  await prisma.ledgerEntry.create({
    data: {
      schoolId: expense.schoolId,
      type: LedgerEntryType.EXPENSE,
      category: expense.category?.name ?? "Other",
      description: expense.description,
      amount: expense.amount,
      vatAmount: expense.vatAmount,
      reference: expense.invoiceRef,
      entryDate: expense.transactionDate,
      recordedById: session!.userId,
      supplierId: expense.supplierId,
      financialAccountId: expense.financialAccountId,
      expenseId: expense.id,
    },
  });
  await logAudit({
    schoolId: expense.schoolId,
    userId: session!.userId,
    action: "EXPENSE_POSTED",
    entity: "Expense",
    entityId: id,
  });
  return NextResponse.json({ expense: updated });
}
