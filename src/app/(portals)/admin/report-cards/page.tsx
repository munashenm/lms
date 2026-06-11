import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { ReportCardForm } from "@/components/assessments/report-card-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ReportCardsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [reportCards, students, academicYears, terms] = await Promise.all([
    prisma.reportCard.findMany({
      where: { student: filter },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        academicYear: { select: { name: true } },
        term: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.findMany({
      where: { ...filter, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    }),
    prisma.academicYear.findMany({ where: filter, orderBy: { name: "desc" } }),
    prisma.term.findMany({
      where: { academicYear: filter, isCurrent: true },
      orderBy: { termNumber: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report Cards</h1>
        <p className="text-muted text-sm mt-1">Generate CAPS/NSC report cards with PDF export</p>
      </div>

      <ReportCardForm
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          studentNumber: s.studentNumber,
        }))}
        academicYears={academicYears.map((y) => ({ id: y.id, name: y.name }))}
        terms={terms.map((t) => ({ id: t.id, name: t.name }))}
      />

      <Card>
        <CardContent className="p-0">
          {reportCards.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No report cards generated yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {reportCards.map((rc) => (
                <div key={rc.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium">
                      {rc.student.firstName} {rc.student.lastName}
                    </p>
                    <p className="text-sm text-muted">
                      {rc.academicYear.name}
                      {rc.term && ` · ${rc.term.name}`}
                      {rc.overallAverage && ` · Avg ${Number(rc.overallAverage)}%`}
                    </p>
                    <p className="text-xs text-muted">
                      {rc.publishedAt && formatDate(rc.publishedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {rc.overallAverage && (
                      <Badge variant="default">{Number(rc.overallAverage)}%</Badge>
                    )}
                    {rc.pdfUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={rc.pdfUrl} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
