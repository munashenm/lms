import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

async function saveExpenseSlip(schoolId: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("File must be under 10 MB");
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Upload a PDF or image (JPG, PNG, WebP)");
  }
  const bytes = await file.arrayBuffer();
  const uploadsDir = path.join(process.cwd(), "public", "uploads", schoolId, "expenses");
  await mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
  return `/uploads/${schoolId}/expenses/${filename}`;
}

async function readExpenseBody(request: NextRequest, schoolId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }
  const form = await request.formData();
  const file = form.get("file");
  let attachmentUrl = emptyToNull(form.get("attachmentUrl"));
  if (file instanceof File && file.size > 0) {
    attachmentUrl = await saveExpenseSlip(schoolId, file);
  }
  return {
    supplierId: emptyToNull(form.get("supplierId")),
    categoryId: emptyToNull(form.get("categoryId")),
    financialAccountId: emptyToNull(form.get("financialAccountId")),
    description: form.get("description"),
    invoiceRef: emptyToNull(form.get("invoiceRef")),
    amount: form.get("amount"),
    vatAmount: form.get("vatAmount") || 0,
    transactionDate: form.get("transactionDate"),
    paymentDate: emptyToNull(form.get("paymentDate")),
    attachmentUrl,
    post: form.get("post") === "on" || form.get("post") === "true",
  };
}

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
  let raw: unknown;
  try {
    raw = await readExpenseBody(request, schoolId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not read expense" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(raw);
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
    metadata: { posted: post },
  });
  return NextResponse.json({ expense }, { status: 201 });
}
