import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentAssignmentsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;
  const schoolId = session!.schoolId;

  const assignments = schoolId && filterIds.length
    ? await prisma.assignment.findMany({
        where: {
          assessment: {
            isPublished: true,
            type: "ASSIGNMENT",
            OR: [
              { subject: { schoolId } },
              { module: { course: { schoolId } } },
            ],
          },
        },
        include: {
          assessment: { include: { subject: true } },
          submissions: { where: { studentId: { in: filterIds } } },
        },
        orderBy: { assessment: { dueDate: "asc" } },
      })
    : [];

  const rows = filterIds.flatMap((id) => {
    const child = children.find((c) => c.id === id);
    if (!child) return [];
    return assignments.map((assignment) => {
      const submission = assignment.submissions.find((s) => s.studentId === id);
      return {
        key: `${id}-${assignment.id}`,
        childName: `${child.firstName} ${child.lastName}`,
        title: assignment.assessment.title,
        subject: assignment.assessment.subject?.name ?? "General",
        dueDate: assignment.assessment.dueDate,
        instructions: assignment.instructions,
        submitted: Boolean(submission),
        submittedAt: submission?.submittedAt ?? null,
        grade: submission?.grade ? Number(submission.grade) : null,
      };
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-muted text-sm mt-1">Homework and assignment status for your children (view only)</p>
      </div>

      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/assignments"
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No published assignments yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.key}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{row.title}</CardTitle>
                  {row.submitted ? (
                    <Badge variant="success">Submitted</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </div>
                <p className="text-sm text-muted">
                  {row.childName} · {row.subject}
                  {row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {row.instructions ? (
                  <p className="whitespace-pre-wrap">{row.instructions}</p>
                ) : null}
                {row.submitted ? (
                  <p className="text-muted">
                    Submitted{row.submittedAt ? ` ${formatDate(row.submittedAt)}` : ""}
                    {row.grade != null ? ` · Mark: ${row.grade}%` : ""}
                  </p>
                ) : (
                  <p className="text-muted">Parents cannot submit on a child’s behalf.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
