import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR, formatDate } from "@/lib/utils";

export default async function StaffPayslipsPage() {
  const session = await getSession();
  const employee = await prisma.employee.findUnique({
    where: { userId: session!.userId },
    include: {
      payrollItems: {
        where: { payslip: { isNot: null } },
        include: { payslip: true, run: true },
        orderBy: { createdAt: "desc" },
        take: 24,
      },
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My payslips</h1>
        <p className="text-muted text-sm mt-1">Secure downloads for your own payslips only.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {!employee || employee.payrollItems.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No payslips yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Number</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Net pay</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {employee.payrollItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{formatDate(item.run.periodStart)} – {formatDate(item.run.periodEnd)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.payslip?.number}</td>
                    <td className="px-4 py-3 text-right">{formatZAR(Number(item.netPay))}</td>
                    <td className="px-4 py-3 text-right">
                      {item.payslip ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/api/payslips/${item.payslip.id}/pdf`}>Download PDF</a>
                        </Button>
                      ) : null}
                    </td>
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
