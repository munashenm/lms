import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LearnerLeaveForm } from "@/components/learner/leave-form";
import { formatDate } from "@/lib/utils";
import { STUDENT_ABSENCE_TYPE_LABELS } from "@/lib/learner-portal";

export default async function StudentLeavePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const requests = student
    ? await prisma.studentAbsenceRequest.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const variant: Record<string, "warning" | "success" | "danger" | "secondary"> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CANCELLED: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Apply Leave / Absence</h1>
        <p className="text-muted text-sm mt-1">Submit a request for your class teacher or office to review.</p>
      </div>
      <LearnerLeaveForm guardianRequired={Boolean(student?.school.studentLeaveRequiresGuardian)} />
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No leave requests yet.</p>
          ) : (
            requests.map((row) => (
              <div key={row.id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {STUDENT_ABSENCE_TYPE_LABELS[row.type]} · {formatDate(row.fromDate)} – {formatDate(row.toDate)}
                  </p>
                  <Badge variant={variant[row.status] ?? "secondary"}>{row.status}</Badge>
                </div>
                <p className="text-muted">{row.reason}</p>
                {row.documentUrl ? (
                  <a
                    href={row.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Supporting document
                  </a>
                ) : null}
                {row.reviewNote ? <p className="text-xs">Office note: {row.reviewNote}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
