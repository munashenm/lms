import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/utils";
import { getFinanceOpsReport } from "@/lib/finance-ops-report";
import { Download } from "lucide-react";

export default async function FinanceReportsPage() {
  const session = await getSession();
  const report = await getFinanceOpsReport(getSchoolFilter(session!));
  const { cards, byMethod, expensesByCategory } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financial reports</h1>
          <p className="text-muted text-sm mt-1">
            Student debtors, collections, income statement and expenses. Balances come from the ledger, not a stored student.balance field.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/finance/reports?format=csv&section=debtors" download>
              <Download className="h-4 w-4 mr-2" />
              Debtors CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/finance/reports?format=csv&section=methods" download>
              <Download className="h-4 w-4 mr-2" />
              Collections CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/finance/reports?format=csv&section=expenses" download>
              <Download className="h-4 w-4 mr-2" />
              Expenses CSV
            </a>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ["Fees raised", cards.feesRaised],
          ["Collected", cards.collected],
          ["Outstanding", cards.outstanding],
          ["Collection rate", cards.collectionRate * 100],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-2xl font-bold">
                {label === "Collection rate" ? `${Number(value).toFixed(1)}%` : formatZAR(Number(value))}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Income statement</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between"><span>Income (fees + other)</span><span>{formatZAR(cards.totalIncome)}</span></p>
            <p className="flex justify-between"><span>Expenses</span><span>{formatZAR(cards.totalExpenses)}</span></p>
            <p className="flex justify-between font-semibold"><span>Net position</span><span>{formatZAR(cards.netPosition)}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Collections by method</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(byMethod).map(([k, v]) => (
              <p key={k} className="flex justify-between"><span>{k}</span><span>{formatZAR(v)}</span></p>
            ))}
            {Object.keys(byMethod).length === 0 && <p className="text-muted">No collections yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(expensesByCategory).map(([k, v]) => (
              <p key={k} className="flex justify-between"><span>{k}</span><span>{formatZAR(v)}</span></p>
            ))}
            {Object.keys(expensesByCategory).length === 0 && <p className="text-muted">No expenses posted.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
