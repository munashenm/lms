import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { AssignmentBoard } from "@/components/learner/assignment-board";
import { getTerminology } from "@/lib/terminology";
import { assignmentStatusLabel } from "@/lib/lms-timeline";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentAssignmentsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const terms = getTerminology(student?.school.institutionType);

  const assignments = student
    ? await prisma.assignment.findMany({
        where: {
          assessment: {
            isPublished: true,
            type: "ASSIGNMENT",
            OR: [
              { subject: { schoolId: student.schoolId } },
              { module: { course: { schoolId: student.schoolId } } },
            ],
          },
        },
        include: {
          assessment: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { firstName: true, lastName: true } },
            },
          },
          submissions: { where: { studentId: student.id } },
        },
        orderBy: { assessment: { dueDate: "asc" } },
      })
    : [];

  const items = assignments.map((a) => {
    const sub = a.submissions[0];
    return {
      assignmentId: a.id,
      title: a.assessment.title,
      subject: a.assessment.subject?.name ?? "General",
      teacher: a.assessment.teacher
        ? `${a.assessment.teacher.firstName} ${a.assessment.teacher.lastName}`
        : null,
      issuedAt: a.assessment.createdAt,
      dueDate: a.assessment.dueDate,
      instructions: a.instructions,
      maxMarks: Number(a.assessment.maxMarks),
      allowLate: a.allowLate,
      submitted: !!sub,
      submittedAt: sub?.submittedAt,
      grade: sub?.grade ? Number(sub.grade) : null,
      feedback: sub?.feedback ?? null,
      fileUrl: sub?.fileUrl ?? null,
      content: sub?.content ?? null,
    };
  });

  const counts = {
    pending: 0,
    submitted: 0,
    graded: 0,
    overdue: 0,
  };
  for (const item of items) {
    const label = assignmentStatusLabel({
      submitted: item.submitted,
      graded: item.grade != null,
      late: Boolean(item.submitted && item.dueDate && item.submittedAt && item.submittedAt > item.dueDate),
      dueAt: item.dueDate,
    });
    if (label === "Graded") counts.graded += 1;
    else if (label === "Submitted" || label === "Late") counts.submitted += 1;
    else if (label === "Overdue") counts.overdue += 1;
    else counts.pending += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{terms.homework}</h1>
        <p className="text-muted text-sm mt-1">
          Open, submit and review feedback on your {terms.homework.toLowerCase()} — materials, due dates and
          marks in one place.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Pending", counts.pending],
          ["Submitted", counts.submitted],
          ["Graded", counts.graded],
          ["Overdue", counts.overdue],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="text-2xl font-semibold mt-1">{value as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <AssignmentBoard assignments={items} homeworkLabel={terms.homework} />
    </div>
  );
}
