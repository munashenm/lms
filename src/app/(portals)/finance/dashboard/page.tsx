import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvoiceList } from "@/components/finance/invoice-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { CreditCard, FileText, TrendingDown, Wallet } from "lucide-react";

export default async function FinanceDashboardPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [invoices, recentPayments] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...filter, status: { not: "CANCELLED" } },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { invoice: filter },
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
  ]);

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

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
        <Button asChild>
          <Link href="/finance/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Billed" value={formatZAR(totalBilled)} icon={FileText} />
        <StatCard title="Collected" value={formatZAR(totalCollected)} icon={Wallet} />
        <StatCard title="Outstanding" value={formatZAR(totalOutstanding)} icon={TrendingDown} />
        <StatCard title="Overdue" value={overdueCount} icon={CreditCard} />
      </div>

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
        <CardContent className="p-4">
          <p className="text-sm text-muted">
            Payment gateways (PayFast, Ozow, Yoco) are gateway-ready in the schema.
            Live integration is planned for Phase 5.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
