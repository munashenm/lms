import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { CatalogSimpleForm } from "@/components/finance/catalog-simple-form";

export default async function SuppliersPage() {
  const session = await getSession();
  const rows = await prisma.supplier.findMany({ where: getSchoolFilter(session!), orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suppliers / vendors</h1>
        <p className="text-muted text-sm mt-1">Used when capturing expenses and recurring costs.</p>
      </div>
      <CatalogSimpleForm title="Add supplier" endpoint="/api/suppliers" rows={rows} />
    </div>
  );
}
