import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { MessagingInbox } from "./messaging-inbox";
import { AccessDenied } from "@/components/layout/access-denied";

export async function MessagingScreen() {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.view")) {
    return <AccessDenied />;
  }

  const schoolId = session.schoolId;
  const teacherOnly = session.role === UserRole.TEACHER;
  const [directory, classes, grades] = schoolId
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            schoolId,
            isActive: true,
            id: { not: session.userId },
            ...(teacherOnly ? { role: { in: [UserRole.STUDENT, UserRole.PARENT] } } : {}),
          },
          select: { id: true, firstName: true, lastName: true, role: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 400,
        }),
        prisma.class.findMany({
          where: { schoolId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.grade.findMany({
          where: { schoolId, isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted text-sm mt-1">Private school messages. You can only open conversations that include you.</p>
      </div>
      <MessagingInbox
        directory={directory.map((user) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName} (${user.role})`,
        }))}
        classes={classes}
        grades={grades}
        canSend={requirePermission(session, "messaging.send")}
        canBulk={requirePermission(session, "messaging.bulk_send")}
      />
    </div>
  );
}
