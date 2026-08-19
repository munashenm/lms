import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";
import { ExpenseManager } from "@/components/finance/expense-manager";

export default async function ExpensesPage() {
  const session = await getSession();
  const schoolId = session!.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (schoolId) await ensureFinanceCatalog(schoolId);
  const filter = getSchoolFilter(session!);
  const [expenses, categories, suppliers, accounts] = await Promise.all([
    prisma.expense.findMany({
      where: filter,
      include: { category: true, supplier: true },
      orderBy: { transactionDate: "desc" },
      take: 100,
    }),
    prisma.expenseCategory.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.financialAccount.findMany({ where: filter, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-muted text-sm mt-1">Institution expenses post into the same ledger used for income reporting.</p>
      </div>
      <ExpenseManager
        expenses={expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          vatAmount: Number(e.vatAmount),
          approvalStatus: e.approvalStatus,
          transactionDate: e.transactionDate,
          category: e.category,
          supplier: e.supplier,
        }))}
        categories={categories}
        suppliers={suppliers}
        accounts={accounts}
      />
    </div>
  );
}
