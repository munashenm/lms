import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { getAttendanceDashboard } from "@/lib/attendance";
import { getTerminology } from "@/lib/terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{
    schoolId?: string;
    date?: string;
    termId?: string;
    threshold?: string;
  }>;
}

export default async function AttendanceDashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "attendance:read")) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const filter = getSchoolFilter(session);
  const schoolId =
    session.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;

  if (!schoolId) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Attendance Dashboard</h1>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <p className="font-medium">{s.name}</p>
                <Link
                  href={`/admin/attendance/dashboard?schoolId=${s.id}`}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  View dashboard
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const date = params.date ?? today;
  const threshold = parseInt(params.threshold ?? "80", 10);

  const [school, terms, dashboard] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, institutionType: true },
    }),
    prisma.term.findMany({
      where: { academicYear: { schoolId } },
      include: { academicYear: { select: { name: true } } },
      orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "asc" }],
    }),
    getAttendanceDashboard({
      schoolId,
      date: new Date(date),
      termId: params.termId,
      threshold: Number.isFinite(threshold) ? threshold : 80,
    }),
  ]);

  if (!school) redirect("/admin/attendance/dashboard");
  const termsLabels = getTerminology(school.institutionType);
  const schoolQuery =
    session.role === UserRole.SUPER_ADMIN ? `&schoolId=${schoolId}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            {school.name} — today&apos;s register and {termsLabels.students.toLowerCase()} below{" "}
            {dashboard.threshold}%
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/attendance${schoolQuery ? `?schoolId=${schoolId}` : ""}`}>
            Take register
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            {session.role === UserRole.SUPER_ADMIN && (
              <input type="hidden" name="schoolId" value={schoolId} />
            )}
            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{termsLabels.period}</label>
              <select
                name="termId"
                defaultValue={params.termId ?? ""}
                className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block min-w-[12rem]"
              >
                <option value="">Last 30 days</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.academicYear.name} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Low attendance %</label>
              <input
                type="number"
                name="threshold"
                min={1}
                max={100}
                defaultValue={dashboard.threshold}
                className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block w-28"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium"
            >
              Apply
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Marked today", value: dashboard.today.marked },
          { label: "Present", value: dashboard.today.present },
          { label: "Absent / Sick", value: dashboard.today.absent + dashboard.today.sick },
          { label: "Attendance %", value: `${dashboard.today.rate}%` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{termsLabels.classLabel} attendance today</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {dashboard.classAttendance.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">No class registers marked for this date.</p>
            )}
            {dashboard.classAttendance.map((row) => (
              <div key={row.classId} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{row.className}</p>
                  <p className="text-xs text-muted">
                    {row.present}/{row.marked} present-like
                  </p>
                </div>
                <Badge variant={row.rate >= 80 ? "success" : row.rate >= 60 ? "warning" : "danger"}>
                  {row.rate}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Below {dashboard.threshold}% attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {dashboard.lowAttendance.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">
                No {termsLabels.students.toLowerCase()} currently below the threshold.
              </p>
            )}
            {dashboard.lowAttendance.map((row) => (
              <div key={row.studentId} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">
                    {row.lastName}, {row.firstName}
                  </p>
                  <p className="text-xs text-muted">
                    {row.studentNumber}
                    {row.gradeName ? ` · ${row.gradeName}` : ""}
                    {row.className ? ` / ${row.className}` : ""}
                    {" · "}
                    {row.presentLike}/{row.total} days
                  </p>
                </div>
                <Badge variant="danger">{row.rate}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
