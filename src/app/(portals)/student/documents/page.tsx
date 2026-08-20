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
import { getDocumentRelease } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";

export default async function StudentDocumentsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const release = student
    ? await getDocumentRelease(student.id)
    : { released: true, outstandingCents: 0, requireFees: false };

  const [documents, certificates, reportCards, letters] = student
    ? await Promise.all([
        prisma.document.findMany({
          where: { schoolId: student.schoolId, OR: [{ isPublic: true }, { learnerVisible: true }] },
          include: { uploader: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        release.released
          ? prisma.certificate.findMany({
              where: { studentId: student.id },
              orderBy: { issuedAt: "desc" },
            })
          : Promise.resolve([]),
        release.released
          ? prisma.reportCard.findMany({
              where: { studentId: student.id, publishedAt: { not: null } },
              include: { academicYear: { select: { name: true } }, term: { select: { name: true } } },
              orderBy: { publishedAt: "desc" },
            })
          : Promise.resolve([]),
        release.released
          ? prisma.issuedLetter.findMany({
              where: { studentId: student.id },
              orderBy: { issuedAt: "desc" },
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], []];

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
      {!release.released ? (
        <DocumentsHoldNotice outstandingCents={release.outstandingCents} feesHref="/student/fees" />
      ) : null}
      {release.released && reportCards.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Report cards</h2>
          {reportCards.map((rc) => (
            <Card key={rc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm">{rc.academicYear.name}{rc.term ? ` — ${rc.term.name}` : ""}</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/report-cards/${rc.id}/pdf`}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {release.released && certificates.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Certificates</h2>
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{cert.title}</p>
                  <p className="text-xs text-muted">{formatDate(cert.issuedAt)}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/certificates/${cert.id}/pdf`}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {release.released && letters.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Letters & transcripts</h2>
          {letters.map((letter) => (
            <Card key={letter.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{letter.title}</p>
                  <p className="text-xs text-muted">
                    {ISSUED_LETTER_LABELS[letter.type] ?? letter.type} · {formatDate(letter.issuedAt)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/letters/${letter.id}/pdf`}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {release.released && reportCards.length === 0 && certificates.length === 0 && letters.length === 0 ? (
        <p className="text-sm text-muted">
          Official reports, certificates and letters appear here once the school issues them.{" "}
          <Link href="/student/report-cards" className="text-primary hover:underline">
            View reports
          </Link>
        </p>
      ) : null}
    </div>
  );
}
