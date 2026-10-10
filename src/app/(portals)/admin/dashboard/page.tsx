import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { EnrollmentChart } from "@/components/dashboard/enrollment-chart";
import { FeeChart } from "@/components/dashboard/fee-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, GraduationCap, CreditCard, Shield } from "lucide-react";
import { formatZAR, formatDate } from "@/lib/utils";
import { getMonthlyEnrollment, getMonthlyFeeCollection } from "@/lib/reports";
import { SystemHealthCards } from "@/components/enterprise/system-health-cards";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { countLicenseUsage } from "@/lib/licensing/usage";
import { getTerminology } from "@/lib/terminology";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { SYSTEM_MODULES } from "@/lib/modules";
import { needsSuperAdminSchoolPicker, resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { getSchoolSetupProgress } from "@/lib/school-setup";
import { SchoolSetupChecklist } from "@/components/admin/school-setup-checklist";
import { summarizeInvoices } from "@/lib/invoice-summary";
import { getAttendanceDashboard } from "@/lib/attendance";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

async function getDashboardData(schoolId: string | null) {
  const filter = schoolId ? { schoolId } : {};

  const [
    totalStudents,
    activeStudents,
    totalTeachers,
    totalClasses,
    invoiceRows,
    recentStudents,
    announcements,
    enrollmentData,
    feeData,
  ] = await Promise.all([
    prisma.student.count({ where: filter }),
    prisma.student.count({ where: { ...filter, status: "ACTIVE" } }),
    prisma.teacher.count({ where: filter }),
    prisma.class.count({ where: { ...filter, isActive: true } }),
    prisma.invoice.findMany({
      where: filter,
      select: { status: true, total: true, amountPaid: true, dueDate: true },
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

  const fees = summarizeInvoices(invoiceRows);
  const attendance = schoolId
    ? await getAttendanceDashboard({ schoolId })
    : null;

  return {
    stats: {
      totalStudents,
      activeStudents,
      totalTeachers,
      totalClasses,
      outstandingAmount: fees.outstanding,
      overdueCount: fees.overdueCount,
      attendanceToday: attendance?.today ?? null,
    },
    enrollmentData,
    feeData,
    recentStudents,
    announcements,
  };
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  const { schoolId: requested } = await searchParams;

  let resolvedRequested = requested;
  if (needsSuperAdminSchoolPicker(session!, resolvedRequested)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    if (schools.length === 1) {
      resolvedRequested = schools[0].id;
    } else if (schools.length !== 1) {
      const platform = await Promise.all([
        prisma.school.count(),
        prisma.school.count({ where: { isActive: true } }),
        prisma.user.count(),
      ]).then(([institutions, activeInstitutions, users]) => ({
        institutions,
        activeInstitutions,
        users,
      }));

      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Platform home</h1>
            <p className="text-muted text-sm mt-1">
              Welcome, {session!.firstName}. Choose a school to work in, or stay on platform tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Institutions" value={platform.institutions} subtitle={`${platform.activeInstitutions} active`} icon={Shield} />
            <StatCard title="Users" value={platform.users} icon={Users} />
            <StatCard title="Schools to pick" value={schools.length} icon={GraduationCap} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/institutions">Institutions</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/users">Users</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/settings/licence-server">Customers & licences</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/audit">Audit</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a school</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {schools.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">
                  No schools yet.{" "}
                  <Link href="/admin/institutions" className="text-primary hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                schools.map((school) => (
                  <div
                    key={school.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-xs text-muted">{school.slug}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/admin/dashboard?schoolId=${school.id}`}>Open school</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/system-health?schoolId=${school.id}`}>Health</Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/applications?schoolId=${school.id}`}>Admissions</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && !session!.schoolId
      ? await resolveLicenseSchoolId(session!, resolvedRequested)
      : session!.schoolId;

  const { stats, enrollmentData, feeData, recentStudents, announcements } =
    await getDashboardData(schoolId);

  const setup =
    schoolId &&
    (session!.role === UserRole.SCHOOL_ADMIN ||
      session!.role === UserRole.SUPER_ADMIN)
      ? await getSchoolSetupProgress(schoolId)
      : null;

  const platform =
    session!.role === UserRole.SUPER_ADMIN && session!.schoolId
      ? await Promise.all([
          prisma.school.count(),
          prisma.school.count({ where: { isActive: true } }),
          prisma.user.count(),
          prisma.student.count({ where: { status: "ACTIVE" } }),
          prisma.schoolModule.count({ where: { enabled: false } }),
          prisma.auditLog.findMany({
            where: {
              action: {
                in: [
                  "PERMISSIONS_UPDATE",
                  "MODULES_UPDATE",
                  "USER_ACTIVATED",
                  "USER_DEACTIVATED",
                  "UPDATE",
                  "PROMOTION",
                  "PROMOTION_OVERRIDE",
                ],
              },
            },
            include: { user: { select: { email: true } } },
            orderBy: { createdAt: "desc" },
            take: 8,
          }),
        ]).then(
          ([institutions, activeInstitutions, users, activeStudents, disabledModules, recentAudit]) => ({
            institutions,
            activeInstitutions,
            users,
            activeStudents,
            enabledModules: Math.max(0, institutions * SYSTEM_MODULES.length - disabledModules),
            disabledModules,
            recentAudit,
          })
        )
      : null;

  const school = schoolId
    ? await prisma.school.findUnique({
        where: { id: schoolId },
        select: { institutionType: true, name: true },
      })
    : null;
  const terms = getTerminology(school?.institutionType);

  let health = null;
  if (schoolId) {
    const [evaluation, usage, license, lastBackup, lastImport] = await Promise.all([
      evaluateStoredLicense(schoolId),
      countLicenseUsage(schoolId),
      prisma.schoolLicense.findUnique({ where: { schoolId } }),
      prisma.backupJob.findFirst({
        where: { schoolId, status: { in: ["SUCCEEDED", "VERIFIED"] } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.importJob.findFirst({
        where: { schoolId, providerCode: "sa-sams" },
        orderBy: { createdAt: "desc" },
        include: { batches: { take: 1, orderBy: { createdAt: "desc" } } },
      }),
    ]);
    health = {
      licence: {
        status: evaluation.effectiveStatus,
        restricted: evaluation.restricted,
        expiry: license?.expiresAt?.toISOString() ?? null,
        usage: {
          learners: { used: usage.activeLearners, max: license?.maxLearners ?? null },
          educators: { used: usage.educators, max: license?.maxEducators ?? null },
        },
        warnings: evaluation.warnings,
      },
      backups: {
        lastSuccessful: lastBackup?.completedAt?.toISOString() ?? null,
        next: null,
        health: lastBackup ? "healthy" : "missing",
      },
      integrations: {
        provider: "SA-SAMS",
        lastImport: (lastImport?.importedAt ?? lastImport?.createdAt)?.toISOString() ?? null,
        status: lastImport?.status ?? "NONE",
        recordsImported: lastImport?.batches[0]
          ? lastImport.batches[0].createdCount + lastImport.batches[0].updatedCount
          : 0,
      },
    };
  }

  const schoolQuery =
    session!.role === UserRole.SUPER_ADMIN && schoolId ? `?schoolId=${schoolId}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {school?.name ? `${school.name}` : "Dashboard"}
        </h1>
        <p className="text-muted text-sm mt-1">
          Welcome back, {session!.firstName}.
          {school?.name ? " School overview and next steps." : " Here's your school overview."}
        </p>
      </div>

      {session!.role === UserRole.SUPER_ADMIN && schoolId && !session!.schoolId ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/dashboard">Change school</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/system-health${schoolQuery}`}>System health</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/applications${schoolQuery}`}>Admissions</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/finance/debtors/age${schoolQuery}`}>Age analysis</Link>
          </Button>
        </div>
      ) : null}

      {setup && !setup.isComplete ? <SchoolSetupChecklist progress={setup} /> : null}

      {session!.role !== UserRole.SUPER_ADMIN || schoolId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/admin/applications">Admissions pipeline</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/finance/debtors/age">Age analysis</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/system-health">System health</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/compliance">Compliance</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/students">Learners</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {platform ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total institutions" value={platform.institutions} subtitle={`${platform.activeInstitutions} active`} icon={Shield} />
          <StatCard title="Total users" value={platform.users} icon={Users} />
          <StatCard title="Active students" value={platform.activeStudents} icon={GraduationCap} />
          <StatCard title="Enabled modules" value={platform.enabledModules} subtitle={`${platform.disabledModules} disabled`} icon={Shield} />
        </div>
      ) : null}
      {platform ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent audit activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {platform.recentAudit.length === 0 ? (
              <p className="text-muted">No recent user or permission changes.</p>
            ) : platform.recentAudit.map((row) => (
              <div key={row.id} className="flex justify-between gap-4">
                <span>{row.action} · {row.entity} · {row.user?.email ?? "system"}</span>
                <Link className="text-primary" href="/admin/audit">View</Link>
              </div>
            ))}
            <div className="flex flex-wrap gap-3 pt-2 text-sm">
              <Link className="text-primary" href="/admin/institutions">Institutions</Link>
              <Link className="text-primary" href="/admin/users">Users</Link>
              <Link className="text-primary" href="/admin/roles">Roles & Permissions</Link>
              <Link className="text-primary" href="/admin/modules">Modules</Link>
              <Link className="text-primary" href="/admin/settings/licence-server">Customers & licences</Link>
              <Link className="text-primary" href="/admin/audit">Audit Logs</Link>
              <Link className="text-primary" href="/admin/settings">System Settings</Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {health && <SystemHealthCards health={health} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={`Total ${terms.students}`}
          value={stats.totalStudents}
          subtitle={`${stats.activeStudents} active`}
          icon={Users}
          trend={stats.attendanceToday ? {
            value: `${stats.attendanceToday.present} present · ${stats.attendanceToday.absent + stats.attendanceToday.sick} absent · ${stats.attendanceToday.late} late`,
            positive: stats.attendanceToday.absent + stats.attendanceToday.sick === 0,
          } : undefined}
        />
        <StatCard
          title="Staff Members"
          value={stats.totalTeachers}
          subtitle={terms.teachers}
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
              <p className="text-sm text-muted py-4 text-center">No {terms.students.toLowerCase()} yet</p>
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
