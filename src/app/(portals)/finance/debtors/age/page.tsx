import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DebtorsAgePanel } from "@/components/finance/debtors-age-panel";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function FinanceDebtorsAgePage() {
  const session = await getSession();
  const allowed =
    requirePermission(session, "finance.view") ||
    requirePermission(session, "finance.reports") ||
    requirePermission(session, "finance.reports.view");
  if (!allowed) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Debtors age analysis</h1>
          <p className="text-sm text-muted mt-1">
            Outstanding balances aged from invoice due dates (Current / 30 / 60 / 90 / 120+)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/finance/debtors">← Debtors list</Link>
        </Button>
      </div>
      <DebtorsAgePanel invoiceBasePath="/finance/invoices" />
    </div>
  );
}
