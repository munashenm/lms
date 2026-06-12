import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LedgerForm } from "@/components/finance/ledger-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate } from "@/lib/utils";

export default async function LedgerPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const entries = await prisma.ledgerEntry.findMany({
    where: filter,
    orderBy: { entryDate: "desc" },
    take: 100,
  });

  const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
  const expenses = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Income & Expenses</h1>
        <p className="text-muted text-sm mt-1">General ledger beyond student fee invoices</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted">Total Income</p>
            <p className="text-2xl font-bold text-success">{formatZAR(income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted">Total Expenses</p>
            <p className="text-2xl font-bold text-danger">{formatZAR(expenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted">Net</p>
            <p className="text-2xl font-bold">{formatZAR(income - expenses)}</p>
          </CardContent>
        </Card>
      </div>

      <LedgerForm />

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No ledger entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{formatDate(entry.entryDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={entry.type === "INCOME" ? "success" : "danger"}>
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{entry.category}</td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatZAR(Number(entry.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
