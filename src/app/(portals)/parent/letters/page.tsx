import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getDocumentReleases, summarizeDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentLettersPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;
  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;
  const { releasedIds, blocked } = summarizeDocumentReleases(
    filterIds,
    await getDocumentReleases(filterIds)
  );

  const letters = releasedIds.length
    ? await prisma.issuedLetter.findMany({
        where: { studentId: { in: releasedIds } },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { issuedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Letters & transcripts</h1>
        <p className="text-muted text-sm mt-1">
          Official letters are released when school fees are paid in full
        </p>
      </div>
      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/letters"
      />
      {blocked ? (
        <DocumentsHoldNotice outstandingCents={blocked.outstandingCents} feesHref="/parent/fees" />
      ) : null}
      {letters.length === 0 && !blocked ? (
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
                  <p className="text-sm text-muted">
                    {letter.student.firstName} {letter.student.lastName}
                  </p>
                  <p className="text-xs text-muted font-mono mt-1">{letter.letterNo}</p>
                  <p className="text-xs text-muted">{formatDate(letter.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="secondary">{ISSUED_LETTER_LABELS[letter.type] ?? letter.type}</Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/letters/${letter.id}/pdf`}>
                      <Download className="h-4 w-4" />
                      PDF
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
