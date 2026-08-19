import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NoticeComposeForm } from "@/components/communications/notice-compose-form";

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

  const [logs, students, grades, classes] = await Promise.all([
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
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-muted text-sm mt-1">
          Send email or SMS notices, and review delivery history (absence alerts, fee notices, and more)
        </p>
      </div>

      {canCompose ? (
        <NoticeComposeForm students={students} grades={grades} classes={classes} />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {logs.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No communications logged yet. Compose a notice, or enable absence SMS in Settings.
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
