import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function AssessmentsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [assessments, subjects, terms] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        OR: [
          { subject: filter },
          { module: { course: filter } },
        ],
      },
      include: {
        subject: { select: { name: true, code: true } },
        term: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        _count: { select: { marks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subject.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.term.findMany({
      where: { academicYear: filter },
      orderBy: { termNumber: "asc" },
    }),
  ]);

  const typeVariant: Record<string, "default" | "accent" | "warning" | "secondary"> = {
    EXAM: "warning",
    TEST: "default",
    ASSIGNMENT: "accent",
    PROJECT: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assessments</h1>
          <p className="text-muted text-sm mt-1">{assessments.length} assessments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/report-cards">Report Cards</Link>
          </Button>
          <AssessmentForm
            subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
            terms={terms.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Marks</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.title}</p>
                    {a.dueDate && (
                      <p className="text-xs text-muted">Due {formatDate(a.dueDate)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeVariant[a.type] ?? "secondary"}>{a.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">
                    {a.subject?.code ?? "—"}
                  </td>
                  <td className="px-4 py-3">{a._count.marks} / {Number(a.maxMarks)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.isPublished ? "success" : "secondary"}>
                      {a.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/assessments/${a.id}`}>Enter Marks</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assessments.length === 0 && (
          <CardContent className="py-12 text-center text-muted">No assessments yet.</CardContent>
        )}
      </Card>
    </div>
  );
}
