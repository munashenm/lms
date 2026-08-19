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
  categoryId: z.string().optional().nullable(),
  financialAccountId: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  vatAmount: z.coerce.number().min(0).optional(),
  receivedAt: z.string().min(1),
  reference: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const items = await prisma.otherIncome.findMany({
    where: getSchoolFilter(session!),
    include: { category: true, financialAccount: true },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ income: items });
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
  const income = await prisma.otherIncome.create({
    data: {
      schoolId,
      categoryId: parsed.data.categoryId ?? null,
      financialAccountId: parsed.data.financialAccountId ?? null,
      description: parsed.data.description,
      amount: parsed.data.amount,
      vatAmount: parsed.data.vatAmount ?? 0,
      receivedAt: new Date(parsed.data.receivedAt),
      reference: parsed.data.reference ?? null,
      approvalStatus: ApprovalStatus.POSTED,
      createdById: session!.userId,
    },
  });
  const category = income.categoryId
    ? await prisma.incomeCategory.findUnique({ where: { id: income.categoryId } })
    : null;
  await prisma.ledgerEntry.create({
    data: {
      schoolId,
      type: LedgerEntryType.INCOME,
      category: category?.name ?? "Other income",
      description: income.description,
      amount: income.amount,
      vatAmount: income.vatAmount,
      reference: income.reference,
      entryDate: income.receivedAt,
      recordedById: session!.userId,
      financialAccountId: income.financialAccountId,
      otherIncomeId: income.id,
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "OtherIncome",
    entityId: income.id,
    metadata: { amount: parsed.data.amount },
  });
  return NextResponse.json({ income }, { status: 201 });
}
