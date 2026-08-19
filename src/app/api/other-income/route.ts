import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, LedgerEntryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";
import { saveFinanceSlip } from "@/lib/finance-uploads";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().optional().nullable(),
  financialAccountId: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  vatAmount: z.coerce.number().min(0).optional(),
  receivedAt: z.string().min(1),
  reference: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

async function readIncomeBody(request: NextRequest, schoolId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }
  const form = await request.formData();
  const file = form.get("file");
  let attachmentUrl = emptyToNull(form.get("attachmentUrl"));
  if (file instanceof File && file.size > 0) {
    attachmentUrl = await saveFinanceSlip(schoolId, "income", file);
  }
  return {
    categoryId: emptyToNull(form.get("categoryId")),
    financialAccountId: emptyToNull(form.get("financialAccountId")),
    description: form.get("description"),
    amount: form.get("amount"),
    vatAmount: form.get("vatAmount") || 0,
    receivedAt: form.get("receivedAt"),
    reference: emptyToNull(form.get("reference")),
    attachmentUrl,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance.view") && !hasPermission(session.role, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const items = await prisma.otherIncome.findMany({
    where: getSchoolFilter(session),
    include: { category: true, financialAccount: true, ledgerEntry: { select: { attachmentUrl: true } } },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    income: items.map((item) => ({
      ...item,
      attachmentUrl: item.ledgerEntry?.attachmentUrl ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance.expenses.manage") && !hasPermission(session.role, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  await ensureFinanceCatalog(schoolId);
  let raw: unknown;
  try {
    raw = await readIncomeBody(request, schoolId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not read income" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(raw);
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
      createdById: session.userId,
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
      recordedById: session.userId,
      financialAccountId: income.financialAccountId,
      otherIncomeId: income.id,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    },
  });
  await logAudit({
    schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "OtherIncome",
    entityId: income.id,
    metadata: { amount: parsed.data.amount },
  });
  return NextResponse.json({ income, attachmentUrl: parsed.data.attachmentUrl ?? null }, { status: 201 });
}
