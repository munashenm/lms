import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";
import { getDocumentReleases, summarizeDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import { OfficialDocumentActions } from "@/components/documents/official-document-actions";

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
  const releaseMap = await getDocumentReleases(filterIds);
  const { blocked } = summarizeDocumentReleases(filterIds, releaseMap);

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
        <p className="text-muted text-sm mt-1">Published reports are released when school fees are paid in full</p>
      </div>

      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/report-cards"
      />

      {blocked ? (
        <DocumentsHoldNotice
          outstandingCents={blocked.outstandingCents}
          feesHref="/parent/fees"
          compact={reportCards.length > 0}
        />
      ) : null}

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
                  <OfficialDocumentActions
                    released={releaseMap.get(rc.studentId)?.released ?? true}
                    href={`/api/report-cards/${rc.id}/pdf`}
                    feesHref="/parent/fees"
                    label="Download PDF"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
