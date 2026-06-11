import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { symbolLabel } from "@/lib/grading";
import { formatDate } from "@/lib/utils";

export default async function StudentResultsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const marks = student
    ? await prisma.mark.findMany({
        where: { studentId: student.id, assessment: { isPublished: true } },
        include: {
          assessment: {
            include: { subject: { select: { name: true, code: true } } },
          },
        },
        orderBy: { recordedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Results</h1>
        <p className="text-muted text-sm mt-1">Published marks and grades</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {marks.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No published results yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Assessment</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Symbol</th>
                  <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => {
                  const pct = Math.round((Number(m.score) / Number(m.assessment.maxMarks)) * 100);
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{m.assessment.title}</td>
                      <td className="px-4 py-3 text-muted">{m.assessment.subject?.code ?? "—"}</td>
                      <td className="px-4 py-3">
                        {Number(m.score)}/{Number(m.assessment.maxMarks)}
                        <span className="text-muted text-xs ml-1">({pct}%)</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge title={m.gradeSymbol ? symbolLabel(m.gradeSymbol) : undefined}>
                          {m.gradeSymbol ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell text-xs">
                        {formatDate(m.recordedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
