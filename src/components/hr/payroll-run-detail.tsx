"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/utils";

export function PayrollRunDetail(props: {
  run: {
    id: string;
    status: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    totalGross: unknown;
    totalNet: unknown;
    items: Array<{
      id: string;
      grossPay: unknown;
      netPay: unknown;
      exceptionNote: string | null;
      employee: { firstName: string; lastName: string; employeeNumber: string };
      payslip?: { id: string } | null;
    }>;
  };
}) {
  const pathname = usePathname();
  const backHref = pathname.startsWith("/admin") ? "/admin/payroll" : "/hr/payroll";
  const exceptions = props.run.items.filter((i) => i.exceptionNote);
  return (
    <div className="space-y-6">
      {exceptions.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Exceptions to review</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {exceptions.map((item) => (
              <p key={item.id}>
                <span className="font-medium">{item.employee.firstName} {item.employee.lastName}</span>
                {" — "}
                {item.exceptionNote}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Employee</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Gross</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Net</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.run.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {item.employee.firstName} {item.employee.lastName}
                    <span className="block text-xs text-muted font-mono">{item.employee.employeeNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(item.grossPay))}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(item.netPay))}</td>
                  <td className="px-4 py-3">{item.exceptionNote ? <Badge variant="warning">{item.exceptionNote}</Badge> : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {item.payslip ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/payslips/${item.payslip.id}/pdf`}>Payslip</a>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <a href={`/api/payroll/runs/${props.run.id}/export`}>Payment listing CSV</a>
        </Button>
        <Button variant="outline" asChild><Link href={backHref}>Back to payroll</Link></Button>
      </div>
    </div>
  );
}
