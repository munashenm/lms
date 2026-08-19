import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatZAR, formatDate } from "@/lib/utils";
import { Users, Palmtree, Banknote, ClipboardCheck, Clock, FileWarning, Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalStatus, LeaveStatus } from "@prisma/client";

export default async function HrDashboardPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 86400000);
  const [headcount, onLeave, latestRun, pendingLeave, pendingTimesheets, expiringDocs, pendingLeaveRows, pendingTimesheetRows, expiringDocRows] =
    await Promise.all([
      prisma.employee.count({ where: { ...filter, status: { not: "TERMINATED" } } }),
      prisma.leaveRequest.count({
        where: {
          ...filter,
          status: LeaveStatus.APPROVED,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      prisma.payrollRun.findFirst({ where: filter, orderBy: { periodStart: "desc" } }),
      prisma.leaveRequest.count({ where: { ...filter, status: LeaveStatus.PENDING } }),
      prisma.timesheet.count({
        where: { employee: filter, status: { in: [ApprovalStatus.DRAFT, ApprovalStatus.PENDING] } },
      }),
      prisma.employeeDocument.count({
        where: { employee: filter, expiresAt: { gte: now, lte: horizon } },
      }),
      prisma.leaveRequest.findMany({
        where: { ...filter, status: LeaveStatus.PENDING },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          applicant: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.timesheet.findMany({
        where: { employee: filter, status: { in: [ApprovalStatus.DRAFT, ApprovalStatus.PENDING] } },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { periodStart: "desc" },
        take: 5,
      }),
      prisma.employeeDocument.findMany({
        where: { employee: filter, expiresAt: { gte: now, lte: horizon } },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { expiresAt: "asc" },
        take: 5,
      }),
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
        <StatCard title="Pending leave" value={pendingLeave} icon={Inbox} subtitle="Awaiting approval" />
        <StatCard title="Open timesheets" value={pendingTimesheets} icon={Clock} subtitle="Draft or submitted" />
        <StatCard title="Docs expiring" value={expiringDocs} icon={FileWarning} subtitle="Next 90 days" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Leave queue</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/hr/leave">Review</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pendingLeaveRows.length === 0 ? <p className="text-muted">No pending requests.</p> : null}
            {pendingLeaveRows.map((row) => (
              <p key={row.id}>
                {row.employee
                  ? `${row.employee.firstName} ${row.employee.lastName}`
                  : `${row.applicant.firstName} ${row.applicant.lastName}`}
                {" · "}
                {formatDate(row.startDate)} – {formatDate(row.endDate)}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Timesheets</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/hr/timesheets">Open</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pendingTimesheetRows.length === 0 ? <p className="text-muted">None waiting.</p> : null}
            {pendingTimesheetRows.map((row) => (
              <p key={row.id}>
                {row.employee.firstName} {row.employee.lastName} · {row.status} · {formatDate(row.periodStart)}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Expiring documents</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/hr/reports">Reports</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {expiringDocRows.length === 0 ? <p className="text-muted">None in the next 90 days.</p> : null}
            {expiringDocRows.map((row) => (
              <p key={row.id}>
                {row.employee.firstName} {row.employee.lastName} · {row.title}
                {row.expiresAt ? ` · ${formatDate(row.expiresAt)}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
