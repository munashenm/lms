import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { CatalogSimpleForm } from "@/components/finance/catalog-simple-form";

export default async function AccountsPage() {
  const session = await getSession();
  const rows = await prisma.financialAccount.findMany({ where: getSchoolFilter(session!), orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cash and bank accounts</h1>
        <p className="text-muted text-sm mt-1">Payment accounts for expenses and other income.</p>
      </div>
      <CatalogSimpleForm title="Add account" endpoint="/api/financial-accounts" rows={rows} />
    </div>
  );
}
