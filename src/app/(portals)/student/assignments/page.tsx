import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { AssignmentSubmit } from "@/components/assessments/assignment-submit";

export default async function StudentAssignmentsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

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
          assessment: { include: { subject: true } },
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
      dueDate: a.assessment.dueDate,
      instructions: a.instructions,
      submitted: !!sub,
      submittedAt: sub?.submittedAt,
      grade: sub?.grade ? Number(sub.grade) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-muted text-sm mt-1">View and submit your assignments</p>
      </div>
      <AssignmentSubmit assignments={items} />
    </div>
  );
}
