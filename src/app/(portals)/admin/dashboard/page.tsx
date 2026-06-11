import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { EnrollmentChart } from "@/components/dashboard/enrollment-chart";
import { FeeChart } from "@/components/dashboard/fee-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, GraduationCap, CreditCard } from "lucide-react";
import { formatZAR, formatDate } from "@/lib/utils";
import { getMonthlyEnrollment, getMonthlyFeeCollection } from "@/lib/reports";

async function getDashboardData(schoolId: string | null) {
  const filter = schoolId ? { schoolId } : {};

  const [
    totalStudents,
    activeStudents,
    totalTeachers,
    totalClasses,
    outstanding,
    recentStudents,
    announcements,
    enrollmentData,
    feeData,
  ] = await Promise.all([
    prisma.student.count({ where: filter }),
    prisma.student.count({ where: { ...filter, status: "ACTIVE" } }),
    prisma.teacher.count({ where: filter }),
    prisma.class.count({ where: { ...filter, isActive: true } }),
    prisma.invoice.aggregate({
      where: {
        ...filter,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.student.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { grade: { select: { name: true } } },
    }),
    prisma.announcement.findMany({
      where: filter,
      orderBy: { publishAt: "desc" },
      take: 3,
    }),
    getMonthlyEnrollment(filter),
    getMonthlyFeeCollection(filter),
  ]);

  const outstandingAmount =
    Number(outstanding._sum.total ?? 0) - Number(outstanding._sum.amountPaid ?? 0);

  const overdueCount = await prisma.invoice.count({
    where: { ...filter, status: "OVERDUE" },
  });

  return {
    stats: { totalStudents, activeStudents, totalTeachers, totalClasses, outstandingAmount, overdueCount },
    enrollmentData,
    feeData,
    recentStudents,
    announcements,
  };
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  const schoolFilter = getSchoolFilter(session!);
  const schoolId = "schoolId" in schoolFilter ? schoolFilter.schoolId : null;

  const { stats, enrollmentData, feeData, recentStudents, announcements } =
    await getDashboardData(schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Welcome back, {session!.firstName}. Here&apos;s your school overview.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          subtitle={`${stats.activeStudents} active`}
          icon={Users}
          trend={{ value: "+12% this term", positive: true }}
        />
        <StatCard
          title="Staff Members"
          value={stats.totalTeachers}
          subtitle="Teachers & lecturers"
          icon={UserCheck}
        />
        <StatCard
          title="Active Classes"
          value={stats.totalClasses}
          icon={GraduationCap}
        />
        <StatCard
          title="Outstanding Fees"
          value={formatZAR(stats.outstandingAmount)}
          icon={CreditCard}
          trend={{ value: `${stats.overdueCount} overdue`, positive: stats.overdueCount === 0 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnrollmentChart data={enrollmentData} />
        <FeeChart data={feeData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Enrolments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentStudents.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No students yet</p>
            ) : (
              <div className="space-y-3">
                {recentStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {student.studentNumber}
                        {student.grade && ` · ${student.grade.name}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        student.status === "ACTIVE"
                          ? "success"
                          : student.status === "APPLICANT"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {student.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No announcements</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div key={ann.id} className="py-2 border-b border-border last:border-0">
                    <p className="text-sm font-medium">{ann.title}</p>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{ann.content}</p>
                    <p className="text-xs text-muted mt-1">{formatDate(ann.publishAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
