import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hrPayrollGate } from "@/components/hr/hr-payroll-gate";
import { employeeForSession } from "@/lib/staff-employee";
import { namedMoneyLines } from "@/lib/payroll-engine";
import { PayBreakdown } from "@/components/hr/pay-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { institutionScope } from "@/lib/tenant";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffPayslipDetailPage({ params }: PageProps) {
  const blocked = await hrPayrollGate();
  if (blocked) return blocked;
  const session = await getSession();
  if (!session) notFound();
  const { id } = await params;
  const employee = await employeeForSession(session);
  if (!employee) notFound();
  const payslip = await prisma.payslip.findFirst({
    where: {
      id,
      item: {
        employeeId: employee.id,
        run: institutionScope(session),
      },
    },
    include: {
      item: { include: { run: true, employee: true } },
    },
  });
  if (!payslip) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/staff/payslips">← All payslips</Link>
        </Button>
        <h1 className="text-2xl font-bold mt-2">Payslip {payslip.number}</h1>
        <p className="text-muted text-sm mt-1">
          {formatDate(payslip.item.run.periodStart)} – {formatDate(payslip.item.run.periodEnd)}
          {payslip.item.run.paymentDate ? ` · Paid ${formatDate(payslip.item.run.paymentDate)}` : ""}
        </p>
      </div>
      <Card>
        <CardContent className="p-5">
          <PayBreakdown
            earnings={namedMoneyLines(payslip.item.earningsJson)}
            deductions={namedMoneyLines(payslip.item.deductionsJson)}
            employer={namedMoneyLines(payslip.item.employerJson)}
            grossPay={Number(payslip.item.grossPay)}
            totalDeductions={Number(payslip.item.totalDeductions)}
            netPay={Number(payslip.item.netPay)}
            employerContributions={Number(payslip.item.employerContributions)}
          />
        </CardContent>
      </Card>
      <Button asChild>
        <a href={`/api/payslips/${payslip.id}/pdf`}>Download PDF</a>
      </Button>
    </div>
  );
}
