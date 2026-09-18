import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR, formatDate } from "@/lib/utils";
import { hrPayrollGate } from "@/components/hr/hr-payroll-gate";
import { employeeForSession } from "@/lib/staff-employee";
import { prisma } from "@/lib/db";
import { namedMoneyLines } from "@/lib/payroll-engine";
import { PayBreakdown } from "@/components/hr/pay-breakdown";
import Link from "next/link";

export default async function StaffPayslipsPage() {
  const blocked = await hrPayrollGate();
  if (blocked) return blocked;
  const session = await getSession();
  const employee = session ? await employeeForSession(session) : null;
  const items = employee
    ? await prisma.payrollItem.findMany({
        where: { employeeId: employee.id, payslip: { isNot: null } },
        include: { payslip: true, run: true },
        orderBy: { createdAt: "desc" },
        take: 24,
      })
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My payslips</h1>
        <p className="text-muted text-sm mt-1">
          Your net pay after deductions. Download the PDF for each finalised payroll period.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {!employee ? (
            <p className="py-12 text-center text-muted text-sm px-4">
              HR has not linked an employee record to this login yet, so payslips cannot be shown.
            </p>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm px-4">
              No payslips yet. They appear here after HR finalises a payroll run.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Number</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Gross</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Deductions</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Net pay</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{formatDate(item.run.periodStart)} – {formatDate(item.run.periodEnd)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.payslip?.number}</td>
                    <td className="px-4 py-3 text-right">{formatZAR(Number(item.grossPay))}</td>
                    <td className="px-4 py-3 text-right">{formatZAR(Number(item.totalDeductions))}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatZAR(Number(item.netPay))}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {item.payslip ? (
                        <>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/staff/payslips/${item.payslip.id}`}>View</Link>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/api/payslips/${item.payslip.id}/pdf`}>PDF</a>
                          </Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {items[0] ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-3">Latest payslip breakdown</p>
            <PayBreakdown
              earnings={namedMoneyLines(items[0].earningsJson)}
              deductions={namedMoneyLines(items[0].deductionsJson)}
              employer={namedMoneyLines(items[0].employerJson)}
              grossPay={Number(items[0].grossPay)}
              totalDeductions={Number(items[0].totalDeductions)}
              netPay={Number(items[0].netPay)}
              employerContributions={Number(items[0].employerContributions)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
