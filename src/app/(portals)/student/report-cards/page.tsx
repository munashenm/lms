import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getDocumentRelease } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";

export default async function StudentReportCardsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const release = student ? await getDocumentRelease(student.id) : { released: true, outstandingCents: 0, requireFees: false };

  const reportCards =
    student && release.released
      ? await prisma.reportCard.findMany({
          where: { studentId: student.id, publishedAt: { not: null } },
          include: {
            academicYear: { select: { name: true } },
            term: { select: { name: true } },
          },
          orderBy: { publishedAt: "desc" },
        })
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted text-sm mt-1">Official reports are released when school fees are paid in full</p>
      </div>

      {!release.released ? (
        <DocumentsHoldNotice outstandingCents={release.outstandingCents} feesHref="/student/fees" />
      ) : reportCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No reports available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reportCards.map((rc) => (
            <Card key={rc.id}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {rc.academicYear.name}
                    {rc.term && ` — ${rc.term.name}`}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {rc.overallAverage && `Average: ${Number(rc.overallAverage)}%`}
                    {rc.publishedAt && ` · ${formatDate(rc.publishedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {rc.overallAverage && (
                    <Badge variant="default">{Number(rc.overallAverage)}%</Badge>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/report-cards/${rc.id}/pdf`}>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
