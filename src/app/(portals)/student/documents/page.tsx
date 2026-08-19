import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentList } from "@/components/documents/document-list";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { documentVisibleToLearner } from "@/lib/learner-portal";
import Link from "next/link";

export default async function StudentDocumentsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const [documents, certificates, reportCards] = student
    ? await Promise.all([
        prisma.document.findMany({
          where: { schoolId: student.schoolId, OR: [{ isPublic: true }, { learnerVisible: true }] },
          include: { uploader: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.certificate.findMany({
          where: { studentId: student.id },
          orderBy: { issuedAt: "desc" },
        }),
        prisma.reportCard.findMany({
          where: { studentId: student.id, publishedAt: { not: null } },
          include: { academicYear: { select: { name: true } }, term: { select: { name: true } } },
          orderBy: { publishedAt: "desc" },
        }),
      ])
    : [[], [], []];

  const visibleDocs = student
    ? documents.filter((doc) =>
        documentVisibleToLearner(doc, {
          id: student.id,
          gradeId: student.gradeId,
          classId: student.classId,
          campusId: student.campusId,
          courseIds: student.enrolments.map((e) => e.courseId).filter((id): id is string => Boolean(id)),
        })
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Documents</h1>
        <p className="text-muted text-sm mt-1">Documents the school has shared with you</p>
      </div>
      <DocumentList documents={visibleDocs} />
      {reportCards.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Report cards</h2>
          {reportCards.map((rc) => (
            <Card key={rc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm">{rc.academicYear.name}{rc.term ? ` — ${rc.term.name}` : ""}</p>
                {rc.pdfUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={rc.pdfUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> PDF</a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild><Link href="/student/report-cards">View</Link></Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {certificates.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Certificates</h2>
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{cert.title}</p>
                  <p className="text-xs text-muted">{formatDate(cert.issuedAt)}</p>
                </div>
                {cert.pdfUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={cert.pdfUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> PDF</a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
