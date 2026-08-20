import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LetterForm } from "@/components/letters/letter-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";
import { getDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsFeeHoldBadge } from "@/components/documents/documents-fee-hold-badge";

export default async function FinanceLettersPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [letters, students] = await Promise.all([
    prisma.issuedLetter.findMany({
      where: { student: filter },
      include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
      orderBy: { issuedAt: "desc" },
      take: 80,
    }),
    prisma.student.findMany({
      where: { ...filter, status: { in: ["ACTIVE", "GRADUATED", "WITHDRAWN"] } },
      orderBy: { lastName: "asc" },
    }),
  ]);
  const releaseMap = await getDocumentReleases([...new Set(letters.map((letter) => letter.studentId))]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Letters & clearance</h1>
        <p className="text-muted text-sm mt-1">
          Issue fee clearance and other official letters. Learners can download them once school
          fees are paid in full.
        </p>
      </div>
      <LetterForm
        defaultType="FEE_CLEARANCE"
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          studentNumber: s.studentNumber,
        }))}
      />
      <Card>
        <CardContent className="p-0">
          {letters.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No letters issued yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {letters.map((letter) => (
                <div key={letter.id} className="flex items-center justify-between px-5 py-4 gap-3">
                  <div>
                    <p className="font-medium">
                      {letter.student.firstName} {letter.student.lastName}
                    </p>
                    <p className="text-sm text-muted">{letter.title}</p>
                    <p className="text-xs text-muted font-mono">{letter.letterNo}</p>
                    <p className="text-xs text-muted">{formatDate(letter.issuedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary">{ISSUED_LETTER_LABELS[letter.type] ?? letter.type}</Badge>
                    <DocumentsFeeHoldBadge released={releaseMap.get(letter.studentId)?.released ?? true} />
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/letters/${letter.id}/pdf`}>
                        <Download className="h-4 w-4" />
                        PDF
                      </a>
                    </Button>
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
