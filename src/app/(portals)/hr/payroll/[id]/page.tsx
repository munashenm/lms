import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { PayrollRunDetail } from "@/components/hr/payroll-run-detail";
import { formatDate } from "@/lib/utils";
import { scopedId } from "@/lib/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function PayrollRunPage({ params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "payroll.view")) notFound();
  const { id } = await params;
  if (!session) notFound();
  const run = await prisma.payrollRun.findFirst({
    where: scopedId(session, id),
    include: {
      items: {
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          payslip: { select: { id: true } },
        },
      },
    },
  });
  if (!run) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payroll run</h1>
        <p className="text-muted text-sm mt-1">
          {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} · {run.status}
        </p>
      </div>
      <PayrollRunDetail run={run} />
    </div>
  );
}
