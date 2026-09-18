import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EmployeeRecord } from "@/components/hr/employee-record";
import { visibleEmployeeDocuments } from "@/lib/timesheet-hours";
import { requirePermission } from "@/lib/rbac";
import { scopedId } from "@/lib/tenant";
import { parsePayrollRules } from "@/lib/payroll-engine";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: Params) {
  const session = await getSession();
  const { id } = await params;
  if (!session) notFound();
  const employee = await prisma.employee.findFirst({
    where: scopedId(session, id),
    include: {
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      leaveEntitlements: { include: { leavePolicy: true }, orderBy: { cycleYear: "desc" } },
      contracts: { orderBy: { startDate: "desc" } },
      payrollItems: {
        where: { payslip: { isNot: null } },
        include: { payslip: true, run: { select: { periodStart: true, periodEnd: true } } },
        orderBy: { createdAt: "desc" },
        take: 24,
      },
    },
  });
  if (!employee) notFound();
  const { bankAccountEnc, ...safe } = employee;
  void bankAccountEnc;
  const isSelf = employee.userId === session.userId;
  const canManage = requirePermission(session, "hr.documents.manage");
  const ruleSet = await prisma.payrollRuleSet.findFirst({
    where: { schoolId: employee.schoolId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employee record</h1>
        <p className="text-muted text-sm mt-1">Salary history, documents and leave balances. Bank account numbers are never shown in full.</p>
      </div>
      <EmployeeRecord
        employee={safe}
        salaryStructures={employee.salaryStructures}
        documents={visibleEmployeeDocuments(employee.documents, {
          isSelf,
          canManageDocs: canManage,
          canView: requirePermission(session, "hr.view"),
        })}
        entitlements={employee.leaveEntitlements}
        contracts={employee.contracts}
        payrollRules={parsePayrollRules(ruleSet?.rulesJson)}
        payslips={employee.payrollItems.flatMap((item) =>
          item.payslip
            ? [{
                id: item.payslip.id,
                number: item.payslip.number,
                netPay: Number(item.netPay),
                grossPay: Number(item.grossPay),
                totalDeductions: Number(item.totalDeductions),
                periodStart: item.run.periodStart,
                periodEnd: item.run.periodEnd,
              }]
            : []
        )}
        canChangeStatus={requirePermission(session, "hr.employees.manage")}
        canInvitePortal={requirePermission(session, "hr.employees.manage")}
      />
    </div>
  );
}
