import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LearnerLeaveForm } from "@/components/learner/leave-form";
import { formatDate } from "@/lib/utils";
import { STUDENT_ABSENCE_TYPE_LABELS } from "@/lib/learner-portal";
import { resolveLinkedStudentId } from "@/lib/parent-scope";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentLeavePage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const selectedId = resolveLinkedStudentId(childIds, studentId);
  const listIds =
    studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const requests = listIds.length
    ? await prisma.studentAbsenceRequest.findMany({
        where: { studentId: { in: listIds } },
        include: {
          student: { select: { firstName: true, lastName: true } },
        },
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
        <p className="text-muted text-sm mt-1">
          Submit a leave request for a linked child. School staff will review it.
        </p>
      </div>

      <ChildFilter
        students={children.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))}
        selectedId={studentId && childIds.includes(studentId) ? studentId : undefined}
        basePath="/parent/leave"
      />

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted">
            No children are linked to this account. Contact the school office.
          </CardContent>
        </Card>
      ) : selectedId ? (
        <LearnerLeaveForm
          guardianRequired={false}
          endpoint="/api/parent/leave"
          studentId={selectedId}
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted">
            Select a child above to submit a leave request.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No leave requests yet.</p>
          ) : (
            requests.map((row) => (
              <div key={row.id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {STUDENT_ABSENCE_TYPE_LABELS[row.type]} · {formatDate(row.fromDate)} –{" "}
                    {formatDate(row.toDate)}
                  </p>
                  <Badge variant={variant[row.status] ?? "secondary"}>{row.status}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {row.student.firstName} {row.student.lastName}
                </p>
                <p className="text-muted">{row.reason}</p>
                {row.reviewNote ? <p className="text-xs">Office note: {row.reviewNote}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
