import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatZAR } from "@/lib/utils";
import { Users, Palmtree, Banknote, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HrDashboardPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [headcount, onLeave, latestRun] = await Promise.all([
    prisma.employee.count({ where: { ...filter, status: { not: "TERMINATED" } } }),
    prisma.leaveRequest.count({
      where: {
        ...filter,
        status: "APPROVED",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    }),
    prisma.payrollRun.findFirst({ where: filter, orderBy: { periodStart: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HR Dashboard</h1>
          <p className="text-muted text-sm mt-1">Employees, leave and payroll for this institution only.</p>
        </div>
        <Button asChild><Link href="/hr/employees">Add employee</Link></Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Headcount" value={headcount} icon={Users} />
        <StatCard title="Currently on leave" value={onLeave} icon={Palmtree} />
        <StatCard title="Last payroll net" value={formatZAR(Number(latestRun?.totalNet ?? 0))} icon={Banknote} />
        <StatCard title="Payroll status" value={latestRun?.status ?? "None"} icon={ClipboardCheck} />
      </div>
    </div>
  );
}
