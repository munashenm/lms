import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getTeacherForSession, classIdsForTeacher } from "@/lib/portal-data";
import { getSchoolFilter } from "@/lib/rbac";
import { ReportCardForm } from "@/components/assessments/report-card-form";
import { ReportCardBatchForm } from "@/components/assessments/report-card-batch-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";
import { getDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsFeeHoldBadge } from "@/components/documents/documents-fee-hold-badge";

export default async function TeacherReportCardsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const teacher = await getTeacherForSession(session!);
  const classIds = classIdsForTeacher(teacher);
  const schoolId = "schoolId" in filter ? filter.schoolId : session!.schoolId;
  const school = schoolId
    ? await prisma.school.findUnique({
        where: { id: schoolId },
        select: { institutionType: true },
      })
    : teacher?.school
      ? { institutionType: teacher.school.institutionType }
      : null;
  const labels = getTerminology(school?.institutionType);

  const [reportCards, students, academicYears, terms, taughtClasses] = await Promise.all([
    classIds.length
      ? prisma.reportCard.findMany({
          where: { student: { ...filter, classId: { in: classIds } } },
          include: {
            student: { select: { firstName: true, lastName: true, studentNumber: true } },
            academicYear: { select: { name: true } },
            term: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    classIds.length
      ? prisma.student.findMany({
          where: { ...filter, status: "ACTIVE", classId: { in: classIds } },
          orderBy: { lastName: "asc" },
        })
      : Promise.resolve([]),
    prisma.academicYear.findMany({ where: filter, orderBy: { name: "desc" } }),
    prisma.term.findMany({
      where: { academicYear: filter, isCurrent: true },
      orderBy: { termNumber: "asc" },
    }),
    classIds.length
      ? prisma.class.findMany({
          where: { id: { in: classIds } },
          include: { grade: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const releaseMap = await getDocumentReleases([...new Set(reportCards.map((rc) => rc.studentId))]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{labels.reportCards}</h1>
        <p className="text-muted text-sm mt-1">
          Generate reports for learners in your classes. Families can download the official PDF once
          school fees are paid in full.
        </p>
      </div>

      <ReportCardBatchForm
        classes={taughtClasses.map((cls) => ({
          id: cls.id,
          name: cls.grade?.name ? `${cls.grade.name} · ${cls.name}` : cls.name,
        }))}
        academicYears={academicYears.map((y) => ({ id: y.id, name: y.name }))}
        terms={terms.map((t) => ({ id: t.id, name: t.name }))}
      />

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
                    <DocumentsFeeHoldBadge released={releaseMap.get(rc.studentId)?.released ?? true} />
                    {rc.pdfUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/report-cards/${rc.id}/pdf`}>
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
