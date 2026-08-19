import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { remainingLeaveDays } from "@/lib/leave-entitlement";
import { formatDate } from "@/lib/utils";

export default async function HrReportsPage() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view")) redirect("/hr/dashboard");
  const filter = getSchoolFilter(session!);
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 86400000);
  const [employees, expiringDocs, entitlements] = await Promise.all([
    prisma.employee.findMany({ where: filter }),
    prisma.employeeDocument.findMany({
      where: {
        employee: filter,
        expiresAt: { gte: now, lte: horizon },
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.leaveEntitlement.findMany({
      where: { employee: filter },
      include: { leavePolicy: true, employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const byDept: Record<string, number> = {};
  for (const e of employees) {
    const key = e.department || "Unassigned";
    byDept[key] = (byDept[key] ?? 0) + 1;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR reports</h1>
        <p className="text-muted text-sm mt-1">Headcount, document expiry and leave remaining for this tenant.</p>
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
          {entitlements.length === 0 ? <p className="text-muted">No entitlements accrued yet.</p> : null}
          {entitlements.map((row) => (
            <p key={row.id} className="flex justify-between">
              <span>{row.employee.firstName} {row.employee.lastName} · {row.leavePolicy.name}</span>
              <span>{remainingLeaveDays({
                openingBalance: Number(row.openingBalance),
                accrued: Number(row.accrued),
                taken: Number(row.taken),
              })}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
