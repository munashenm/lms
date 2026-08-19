import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { AssignmentBoard } from "@/components/learner/assignment-board";
import { getTerminology } from "@/lib/terminology";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{terms.homework}</h1>
        <p className="text-muted text-sm mt-1">Open, submit and review feedback on your {terms.homework.toLowerCase()}</p>
      </div>
      <AssignmentBoard assignments={items} homeworkLabel={terms.homework} />
    </div>
  );
}
