import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { RolloverWizard } from "@/components/academic/rollover-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function RolloverPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "settings:write")) {
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
          <h1 className="text-2xl font-bold">Year-End Rollover</h1>
          <p className="text-muted text-sm mt-1">Select a school to run the rollover wizard</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <p className="font-medium">{s.name}</p>
                <Link
                  href={`/admin/academic/rollover?schoolId=${s.id}`}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Open wizard
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [school, sessions, grades, classes] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, institutionType: true },
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      select: { id: true, name: true, isCurrent: true, status: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.grade.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, gradeId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!school) redirect("/admin/academic/rollover");

  const terms = getTerminology(school.institutionType);
  const schoolQuery =
    session.role === UserRole.SUPER_ADMIN ? `?schoolId=${schoolId}` : "";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/academic${schoolQuery}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Year-End Rollover</h1>
          <p className="text-muted text-sm mt-1">
            {school.name} — promote, repeat, graduate or withdraw {terms.students.toLowerCase()}
            into a new academic session
          </p>
        </div>
      </div>

      {sessions.length < 2 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted space-y-3">
            <p>
              You need at least two academic sessions to run a rollover. Create the next session
              first, then return here.
            </p>
            <Button asChild>
              <Link href={`/admin/academic${schoolQuery}`}>Manage sessions</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <RolloverWizard
          schoolId={schoolId}
          sessions={sessions}
          grades={grades}
          classes={classes}
          terms={terms}
        />
      )}
    </div>
  );
}
