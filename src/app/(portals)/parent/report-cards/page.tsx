import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentReportCardsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const terms = getTerminology(guardian?.school.institutionType);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const reportCards = filterIds.length
    ? await prisma.reportCard.findMany({
        where: { studentId: { in: filterIds }, publishedAt: { not: null } },
        include: {
          academicYear: { select: { name: true } },
          term: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { publishedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{terms.reportCards}</h1>
        <p className="text-muted text-sm mt-1">Published reports for your children</p>
      </div>

      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/report-cards"
      />

      {reportCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No report cards available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reportCards.map((rc) => (
            <Card key={rc.id}>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {rc.student.firstName} {rc.student.lastName}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {rc.academicYear.name}
                    {rc.term && ` — ${rc.term.name}`}
                    {rc.overallAverage && ` · Average: ${Number(rc.overallAverage)}%`}
                    {rc.publishedAt && ` · ${formatDate(rc.publishedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {rc.overallAverage && (
                    <Badge variant="default">{Number(rc.overallAverage)}%</Badge>
                  )}
                  {rc.pdfUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={rc.pdfUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                        Download PDF
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
