import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { HomeworkGradingPanel } from "@/components/academic/homework-grading-panel";
import { AccessDenied } from "@/components/layout/access-denied";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export async function HomeworkDesk({ createHref }: { createHref: string }) {
  const session = await getSession();
  if (!session || (!requirePermission(session, "homework.grade") && !requirePermission(session, "marks:write"))) {
    return <AccessDenied />;
  }
  const filter = getSchoolFilter(session);
  const assignments = await prisma.assignment.findMany({
    where: { assessment: { ...filter, type: "ASSIGNMENT" } },
    include: {
      assessment: { select: { title: true, dueDate: true, maxMarks: true } },
      submissions: {
        include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Homework & study materials</h1>
          <p className="text-muted text-sm mt-1">
            Grade submitted homework. Create new homework from Assessments using type Assignment.
          </p>
        </div>
        <Button asChild>
          <Link href={createHref}>Create homework</Link>
        </Button>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted">No homework assignments yet.</p>
      ) : (
        assignments.map((assignment) => (
          <HomeworkGradingPanel
            key={assignment.id}
            assignmentId={assignment.id}
            title={`${assignment.assessment.title}${assignment.assessment.dueDate ? ` · due ${assignment.assessment.dueDate.toISOString().slice(0, 10)}` : ""}`}
            submissions={assignment.submissions.map((row) => ({
              id: row.id,
              content: row.content,
              fileUrl: row.fileUrl,
              fileUrls: row.fileUrls,
              submittedAt: row.submittedAt.toISOString(),
              grade: row.grade == null ? null : Number(row.grade),
              feedback: row.feedback,
              status: row.status,
              late: row.late,
              student: row.student,
            }))}
          />
        ))
      )}
    </div>
  );
}
