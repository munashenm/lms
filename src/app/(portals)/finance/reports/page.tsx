import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZAR } from "@/lib/utils";
import { getOutstandingBalance } from "@/lib/finance";

export default async function FinanceReportsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [invoices, payments, ledger] = await Promise.all([
    prisma.invoice.findMany({ where: { ...filter, status: { not: "CANCELLED" } } }),
    prisma.payment.findMany({ where: { ...("schoolId" in filter ? { schoolId: filter.schoolId } : {}), reversedAt: null } }),
    prisma.ledgerEntry.findMany({ where: filter }),
  ]);
  const feesRaised = invoices.reduce((s, i) => s + Number(i.total), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.reduce((s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)), 0);
  const income = ledger.filter((e) => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0) + collected;
  const expenses = ledger.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  const byCategory: Record<string, number> = {};
  for (const e of ledger.filter((row) => row.type === "EXPENSE")) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial reports</h1>
        <p className="text-muted text-sm mt-1">Student debtors, collections, income statement and expenses. Balances come from the ledger, not a stored student.balance field.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ["Fees raised", feesRaised],
          ["Collected", collected],
          ["Outstanding", outstanding],
          ["Collection rate", feesRaised ? (collected / feesRaised) * 100 : 0],
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
            <p className="flex justify-between"><span>Income (fees + other)</span><span>{formatZAR(income)}</span></p>
            <p className="flex justify-between"><span>Expenses</span><span>{formatZAR(expenses)}</span></p>
            <p className="flex justify-between font-semibold"><span>Net position</span><span>{formatZAR(income - expenses)}</span></p>
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
            {Object.entries(byCategory).map(([k, v]) => (
              <p key={k} className="flex justify-between"><span>{k}</span><span>{formatZAR(v)}</span></p>
            ))}
            {Object.keys(byCategory).length === 0 && <p className="text-muted">No expenses posted.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
