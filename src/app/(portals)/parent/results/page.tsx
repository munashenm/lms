import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { symbolLabel } from "@/lib/grading";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentResultsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const marks = filterIds.length
    ? await prisma.mark.findMany({
        where: {
          studentId: { in: filterIds },
          assessment: { isPublished: true },
        },
        include: {
          student: { select: { firstName: true, lastName: true } },
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
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted text-sm mt-1">Published marks and grades for your children</p>
      </div>

      <ChildFilter
        children={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/results"
      />

      <Card>
        <CardContent className="p-0">
          {marks.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No published results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Assessment</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Symbol</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m) => {
                    const pct = Math.round(
                      (Number(m.score) / Number(m.assessment.maxMarks)) * 100
                    );
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          {m.student.firstName} {m.student.lastName}
                        </td>
                        <td className="px-4 py-3 font-medium">{m.assessment.title}</td>
                        <td className="px-4 py-3 text-muted">
                          {m.assessment.subject?.code ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {Number(m.score)}/{Number(m.assessment.maxMarks)}
                          <span className="text-muted text-xs ml-1">({pct}%)</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge title={m.gradeSymbol ? symbolLabel(m.gradeSymbol) : undefined}>
                            {m.gradeSymbol ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted hidden sm:table-cell">
                          {formatDate(m.recordedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
