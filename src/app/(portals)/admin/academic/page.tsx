import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { AcademicSessionManager } from "@/components/academic/academic-session-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTerminology, PERIOD_STRUCTURE_LABELS } from "@/lib/terminology";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function AcademicSessionsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "settings:read")) {
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
        <div>
          <h1 className="text-2xl font-bold">Academic Sessions</h1>
          <p className="text-muted text-sm mt-1">Select a school to manage sessions</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <p className="font-medium">{s.name}</p>
                <Link
                  href={`/admin/academic?schoolId=${s.id}`}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Manage sessions
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [school, sessions] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        institutionType: true,
        periodStructure: true,
      },
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      include: {
        terms: { orderBy: { termNumber: "asc" } },
        _count: { select: { enrolments: true, classes: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  if (!school) redirect("/admin/academic");

  const terms = getTerminology(school.institutionType);
  const schoolQuery =
    session.role === UserRole.SUPER_ADMIN ? `?schoolId=${schoolId}` : "";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Academic Sessions</h1>
          <p className="text-muted text-sm mt-1">
            {school.name} — {PERIOD_STRUCTURE_LABELS[school.periodStructure]} ·{" "}
            manage years and {terms.periods.toLowerCase()}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/academic/rollover${schoolQuery}`}>Year-end rollover</Link>
        </Button>
      </div>

      <AcademicSessionManager
        schoolId={schoolId}
        terms={terms}
        periodLabel={terms.period}
        sessions={sessions.map((s) => ({
          id: s.id,
          name: s.name,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
          status: s.status,
          isCurrent: s.isCurrent,
          _count: s._count,
          terms: s.terms.map((t) => ({
            id: t.id,
            name: t.name,
            termNumber: t.termNumber,
            startDate: t.startDate.toISOString(),
            endDate: t.endDate.toISOString(),
            status: t.status,
            isCurrent: t.isCurrent,
            resultsPublishingDate: t.resultsPublishingDate?.toISOString() ?? null,
            attendanceStartDate: t.attendanceStartDate?.toISOString() ?? null,
            attendanceEndDate: t.attendanceEndDate?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}
