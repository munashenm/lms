import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvoiceList } from "@/components/finance/invoice-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLLECTED_PAYMENT_WHERE, getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { CreditCard, FileText, TrendingDown, Wallet } from "lucide-react";
import { FinancePositionChart } from "@/components/finance/finance-position-chart";

export default async function FinanceDashboardPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [invoices, recentPayments, ledger] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...filter, status: { not: "CANCELLED" } },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { invoice: filter, ...COLLECTED_PAYMENT_WHERE },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.ledgerEntry.findMany({ where: filter, select: { type: true, amount: true, entryDate: true } }),
  ]);

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const totalIncome = ledger.filter((e) => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0) + totalCollected;
  const totalExpenses = ledger.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const chartMap = new Map(monthKeys.map((k) => [k, { month: k.slice(5), income: 0, expenses: 0 }]));
  for (const row of ledger) {
    const key = `${row.entryDate.getUTCFullYear()}-${String(row.entryDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = chartMap.get(key);
    if (!bucket) continue;
    if (row.type === "INCOME") bucket.income += Number(row.amount);
    if (row.type === "EXPENSE") bucket.expenses += Number(row.amount);
  }
  const chartData = monthKeys.map((k) => {
    const row = chartMap.get(k)!;
    return {
      month: new Date(`${k}-01T00:00:00Z`).toLocaleString("en-ZA", { month: "short" }),
      income: row.income,
      expenses: row.expenses,
    };
  });

  const recentInvoices = invoices.slice(0, 8).map((i) => ({
    ...i,
    total: Number(i.total),
    amountPaid: Number(i.amountPaid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Finance Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Welcome, {session!.firstName}. Manage billing and payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/finance/invoices/new">New Invoice</Link>
          </Button>
          <Button asChild>
            <Link href="/finance/collect">Collect fees</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Fees Raised" value={formatZAR(totalBilled)} icon={FileText} />
        <StatCard title="Total Collected" value={formatZAR(totalCollected)} icon={Wallet} />
        <StatCard title="Outstanding" value={formatZAR(totalOutstanding)} icon={TrendingDown} />
        <StatCard title="Overdue" value={overdueCount} icon={CreditCard} />
        <StatCard title="Total Income" value={formatZAR(totalIncome)} icon={Wallet} />
        <StatCard title="Total Expenses" value={formatZAR(totalExpenses)} icon={TrendingDown} />
        <StatCard title="Net Position" value={formatZAR(totalIncome - totalExpenses)} icon={FileText} />
        <StatCard title="Collection Rate" value={`${collectionRate.toFixed(1)}%`} icon={CreditCard} />
      </div>

      <FinancePositionChart data={chartData} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/finance/invoices">View all</Link>
            </Button>
          </div>
          <InvoiceList
            invoices={recentInvoices}
            detailHref={(id) => `/finance/invoices/${id}`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <p className="px-4 py-8 text-center text-muted text-sm">No payments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentPayments.map((p) => (
                  <div key={p.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">{formatZAR(Number(p.amount))}</p>
                    <p className="text-xs text-muted">
                      {p.invoice.invoiceNumber} · {p.invoice.student.firstName} {p.invoice.student.lastName}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finance operations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/collect">Collect fees</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/charges">Charges</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/payments">Payments</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/expenses">Expenses</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/adjustments">Adjustments</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/reports">Reports</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
