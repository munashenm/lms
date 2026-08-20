import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NoticeComposeForm } from "@/components/communications/notice-compose-form";
import { SendRemainingButton } from "@/components/communications/send-remaining-button";

export default async function CommunicationsPage() {
  const session = await getSession();
  if (
    !session ||
    (!hasPermission(session.role, "settings:read") &&
      !hasPermission(session.role, "finance:read"))
  ) {
    redirect("/admin/dashboard");
  }

  const filter = getSchoolFilter(session);
  const canCompose =
    hasPermission(session.role, "announcements:write") ||
    hasPermission(session.role, "settings:write");

  const [logs, queuedBatches, students, grades, classes] = await Promise.all([
    prisma.communicationLog.findMany({
      where: filter,
      include: {
        student: {
          select: { firstName: true, lastName: true, studentNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.communicationBatch.findMany({
      where: { ...filter, queuedCount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    canCompose
      ? prisma.student.findMany({
          where: { ...filter, status: "ACTIVE" },
          select: { id: true, firstName: true, lastName: true, studentNumber: true },
          orderBy: { lastName: "asc" },
          take: 400,
        })
      : Promise.resolve([]),
    canCompose
      ? prisma.grade.findMany({
          where: { ...filter, isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    canCompose
      ? prisma.class.findMany({
          where: { ...filter, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const statusVariant: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    SENT: "success",
    FAILED: "danger",
    QUEUED: "warning",
    LOGGED: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email & SMS</h1>
        <p className="text-muted text-sm mt-1">
          Send email or SMS notices, and review delivery history (absence alerts, fee notices, and more)
        </p>
      </div>

      {canCompose ? (
        <NoticeComposeForm students={students} grades={grades} classes={classes} />
      ) : null}

      {queuedBatches.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Queued notice batches</p>
            <p className="text-xs text-muted">
              Large sends are processed in chunks. Use Send remaining until the queue is empty.
            </p>
            {queuedBatches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="text-sm">
                  <p className="font-medium">{batch.category.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted">
                    {batch.queuedCount} queued · {batch.sentCount} sent · {batch.failedCount} failed
                  </p>
                </div>
                <SendRemainingButton batchId={batch.id} queuedCount={batch.queuedCount} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {logs.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No email or SMS logged yet. Compose a notice, or enable absence SMS in Settings.
              </p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{log.channel}</Badge>
                    <Badge variant="default">{log.category.replaceAll("_", " ")}</Badge>
                    <Badge variant={statusVariant[log.status] ?? "secondary"}>{log.status}</Badge>
                  </div>
                  <p className="text-xs text-muted">{formatDate(log.createdAt)}</p>
                </div>
                <p className="font-medium">
                  {log.recipientName ?? "Recipient"} · {log.recipientContact}
                </p>
                {log.student && (
                  <p className="text-xs text-muted">
                    {log.student.firstName} {log.student.lastName} ({log.student.studentNumber})
                  </p>
                )}
                {log.subject && <p className="text-xs text-muted">{log.subject}</p>}
                <p className="text-muted whitespace-pre-wrap">{log.message}</p>
                {log.error && <p className="text-xs text-danger">{log.error}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
