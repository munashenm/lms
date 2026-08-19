import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = session!.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (schoolId) await ensureFinanceCatalog(schoolId);
  const filter = getSchoolFilter(session!);
  const [expenseCategories, incomeCategories, accounts, suppliers] = await Promise.all([
    prisma.expenseCategory.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.incomeCategory.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.financialAccount.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ expenseCategories, incomeCategories, accounts, suppliers });
}
