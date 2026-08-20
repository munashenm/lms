import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getDocumentRelease } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import { OfficialDocumentActions } from "@/components/documents/official-document-actions";
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";

export default async function StudentLettersPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const release = student
    ? await getDocumentRelease(student.id)
    : { released: true, outstandingCents: 0, requireFees: false };
  const letters = student
    ? await prisma.issuedLetter.findMany({
        where: { studentId: student.id },
        orderBy: { issuedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Letters & transcripts</h1>
        <p className="text-muted text-sm mt-1">
          Transfer letters and official documents are released when school fees are paid in full
        </p>
      </div>
      {!release.released ? (
        <DocumentsHoldNotice
          outstandingCents={release.outstandingCents}
          feesHref="/student/fees"
          compact={letters.length > 0}
        />
      ) : null}
      {letters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">No letters issued yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <Card key={letter.id}>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{letter.title}</p>
                  <p className="text-xs text-muted font-mono mt-1">{letter.letterNo}</p>
                  <p className="text-xs text-muted">{formatDate(letter.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{ISSUED_LETTER_LABELS[letter.type] ?? letter.type}</Badge>
                  <OfficialDocumentActions
                    released={release.released}
                    href={`/api/letters/${letter.id}/pdf`}
                    feesHref="/student/fees"
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
