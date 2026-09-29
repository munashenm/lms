import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOutstandingBalance } from "@/lib/finance";
import { formatDate, formatZAR } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";
import { getDocumentReleases, summarizeDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";

export default async function ParentDashboardPage() {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const terms = getTerminology(guardian?.school.institutionType);
  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const { blocked } = summarizeDocumentReleases(
    childIds,
    await getDocumentReleases(childIds)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 21);

  const [invoices, recentAbsence, upcomingAssessments, unreadMessages] = await Promise.all([
    childIds.length > 0
      ? prisma.invoice.findMany({
          where: {
            studentId: { in: childIds },
            status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    childIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: {
            studentId: { in: childIds },
            date: { gte: weekAgo },
            status: { in: ["ABSENT", "LATE"] },
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    childIds.length > 0 && (guardian?.schoolId || session!.schoolId)
      ? prisma.assessment.findMany({
          where: {
            isPublished: true,
            dueDate: { gte: today, lte: soon },
            OR: [
              { subject: { schoolId: guardian?.schoolId ?? session!.schoolId! } },
              { module: { course: { schoolId: guardian?.schoolId ?? session!.schoolId! } } },
            ],
          },
          include: {
            subject: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.messageRecipient.count({
      where: { userId: session!.userId, readAt: null },
    }),
  ]);

  const feesDue = invoices
    .map((i) => ({
      ...i,
      balance: getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    }))
    .filter((i) => i.balance > 0);
  const feesTotal = feesDue.reduce((s, i) => s + i.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="text-muted text-sm mt-1">
          Welcome, {session!.firstName}. Fees, attendance, assessments and messages at a glance.
        </p>
      </div>

      {blocked ? (
        <DocumentsHoldNotice outstandingCents={blocked.outstandingCents} feesHref="/parent/fees" />
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/parent/fees"
          className="rounded-lg border border-border bg-surface px-3 py-3 hover:border-primary/40"
        >
          <p className="text-xs text-muted">Fees due</p>
          <p className="text-lg font-semibold mt-1">{formatZAR(feesTotal)}</p>
        </Link>
        <Link
          href="/parent/attendance"
          className="rounded-lg border border-border bg-surface px-3 py-3 hover:border-primary/40"
        >
          <p className="text-xs text-muted">Attendance alerts</p>
          <p className="text-lg font-semibold mt-1">{recentAbsence.length}</p>
        </Link>
        <Link
          href="/parent/assignments"
          className="rounded-lg border border-border bg-surface px-3 py-3 hover:border-primary/40"
        >
          <p className="text-xs text-muted">Upcoming assessments</p>
          <p className="text-lg font-semibold mt-1">{upcomingAssessments.length}</p>
        </Link>
        <Link
          href="/parent/messages"
          className="rounded-lg border border-border bg-surface px-3 py-3 hover:border-primary/40"
        >
          <p className="text-xs text-muted">Unread messages</p>
          <p className="text-lg font-semibold mt-1">{unreadMessages}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Fees due</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/parent/fees">{terms.fees}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {feesDue.length === 0 ? (
              <p className="text-sm text-muted">Nothing outstanding right now.</p>
            ) : (
              feesDue.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {inv.student.firstName} {inv.student.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {inv.invoiceNumber}
                      {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatZAR(inv.balance)}</p>
                    {inv.status === "OVERDUE" ? (
                      <Badge variant="danger">Overdue</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Attendance alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/parent/attendance">View</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentAbsence.length === 0 ? (
              <p className="text-sm text-muted">No absences or late marks this week.</p>
            ) : (
              recentAbsence.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {row.student.firstName} {row.student.lastName}
                    </p>
                    <p className="text-xs text-muted">{formatDate(row.date)}</p>
                  </div>
                  <Badge variant={row.status === "ABSENT" ? "danger" : "warning"}>
                    {row.status === "ABSENT" ? "Absent" : "Late"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Upcoming assessments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/parent/results">Results</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAssessments.length === 0 ? (
              <p className="text-sm text-muted">No assessments due in the next three weeks.</p>
            ) : (
              upcomingAssessments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 py-2"
                >
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted">{a.subject?.name ?? a.type}</p>
                  </div>
                  <p className="text-xs text-muted">
                    {a.dueDate ? formatDate(a.dueDate) : "—"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">My children</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/parent/children">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {children.length === 0 ? (
              <p className="text-sm text-muted">No linked children.</p>
            ) : (
              children.map((child) => (
                <div key={child.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm">
                      {child.firstName} {child.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {child.grade?.name ?? "—"}
                      {child.class?.name ? ` · ${child.class.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/parent/fees?studentId=${child.id}`}>Fees</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/parent/attendance?studentId=${child.id}`}>Attendance</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/parent/results?studentId=${child.id}`}>Results</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/parent/messages">Messages</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
