import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function HrReportsPage() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view")) redirect("/hr/dashboard");
  const filter = getSchoolFilter(session!);
  const employees = await prisma.employee.findMany({ where: filter });
  const byDept: Record<string, number> = {};
  for (const e of employees) {
    const key = e.department || "Unassigned";
    byDept[key] = (byDept[key] ?? 0) + 1;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR reports</h1>
        <p className="text-muted text-sm mt-1">Headcount, department mix and employment type for this campus/tenant.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Headcount by department</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(byDept).map(([k, v]) => (
            <p key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></p>
          ))}
          <p className="flex justify-between font-semibold pt-2"><span>Total</span><span>{employees.length}</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
