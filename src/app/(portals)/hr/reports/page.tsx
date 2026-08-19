import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, formatZAR } from "@/lib/utils";
import { getHrReport } from "@/lib/reports";
import { ReportPanel } from "@/components/reports/report-panel";

export default async function HrReportsPage() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view")) notFound();
  const filter = getSchoolFilter(session);
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 86400000);
  const [hr, expiringDocs] = await Promise.all([
    getHrReport(filter),
    prisma.employeeDocument.findMany({
      where: {
        employee: filter,
        expiresAt: { gte: now, lte: horizon },
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR reports</h1>
        <p className="text-muted text-sm mt-1">Headcount, document expiry and leave remaining for this tenant.</p>
      </div>
      <ReportPanel
        title="Headcount by department"
        description="Active staff by department. Terminated employees are excluded from headcount."
        exportType="hr"
        summary={[
          { label: "Headcount", value: String(hr.headcount) },
          { label: "On leave", value: String(hr.onLeave) },
          { label: "Contracts expiring", value: String(hr.contractExpiry) },
          {
            label: "Latest payroll net",
            value: hr.payrollTotals[0] ? formatZAR(hr.payrollTotals[0].totalNet) : "—",
          },
        ]}
        columns={[
          { key: "department", label: "Department" },
          { key: "employees", label: "Employees", align: "right" },
        ]}
        rows={Object.entries(hr.byDepartment)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([department, employees]) => ({ department, employees }))}
      />
      <Card>
        <CardHeader><CardTitle>Documents expiring in 90 days</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {expiringDocs.length === 0 ? <p className="text-muted">None.</p> : null}
          {expiringDocs.map((doc) => (
            <p key={doc.id}>
              {doc.employee.firstName} {doc.employee.lastName} · {doc.title} ({doc.type}) · {doc.expiresAt ? formatDate(doc.expiresAt) : ""}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Leave remaining</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {hr.leaveBalances.length === 0 ? <p className="text-muted">No entitlements accrued yet.</p> : null}
          {hr.leaveBalances.map((row) => (
            <p key={`${row.employeeNumber}-${row.policy}`} className="flex justify-between">
              <span>{row.employee} · {row.policy}</span>
              <span>{row.remaining}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
