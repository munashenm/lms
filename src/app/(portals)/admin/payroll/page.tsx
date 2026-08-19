import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { PayrollManager } from "@/components/hr/payroll-manager";
import { PayrollRulesForm } from "@/components/hr/payroll-rules-form";
import { parsePayrollRules } from "@/lib/payroll-engine";

export default async function AdminPayrollPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [runs, ruleSet] = await Promise.all([
    prisma.payrollRun.findMany({
      where: filter,
      orderBy: { periodStart: "desc" },
    }),
    prisma.payrollRuleSet.findFirst({
      where: { ...filter, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payroll</h1>
        <p className="text-muted text-sm mt-1">Finalising a run posts salary expenses to Finance with the payroll run ID.</p>
      </div>
      <PayrollRulesForm
        current={ruleSet ? {
          name: ruleSet.name,
          jurisdiction: ruleSet.jurisdiction,
          effectiveFrom: ruleSet.effectiveFrom,
          rules: parsePayrollRules(ruleSet.rulesJson),
        } : null}
      />
      <PayrollManager
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          totalGross: r.totalGross,
          totalNet: r.totalNet,
          totalEmployer: r.totalEmployer,
        }))}
      />
    </div>
  );
}
