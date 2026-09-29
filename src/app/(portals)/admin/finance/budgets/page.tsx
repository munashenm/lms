import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BudgetProjectsPanel } from "@/components/finance/budget-projects-panel";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function BudgetProjectsPage() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view")) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budgets & projects</h1>
          <p className="text-muted text-sm mt-1">
            Annual budgets and ad hoc finance projects (tours, civvies, fundraising)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/finance">← Finance overview</Link>
        </Button>
      </div>
      <BudgetProjectsPanel />
    </div>
  );
}