import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";
import { IncomeManager } from "@/components/finance/income-manager";

export default async function IncomePage() {
  const session = await getSession();
  const schoolId = session!.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (schoolId) await ensureFinanceCatalog(schoolId);
  const filter = getSchoolFilter(session!);
  const [items, categories] = await Promise.all([
    prisma.otherIncome.findMany({ where: filter, include: { category: true }, orderBy: { receivedAt: "desc" } }),
    prisma.incomeCategory.findMany({ where: filter, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Other income</h1>
        <p className="text-muted text-sm mt-1">Donations, grants, rentals, events and sales feed the same reporting engine as student fees.</p>
      </div>
      <IncomeManager
        items={items.map((i) => ({ id: i.id, description: i.description, amount: Number(i.amount), receivedAt: i.receivedAt, category: i.category }))}
        categories={categories}
      />
    </div>
  );
}
