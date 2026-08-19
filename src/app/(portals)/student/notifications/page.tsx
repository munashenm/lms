import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationsMarkAll } from "@/components/learner/notifications-mark-all";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function StudentNotificationsPage() {
  const session = await getSession();
  const items = session
    ? await prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted text-sm mt-1">{unread} unread</p>
        </div>
        {unread > 0 ? <NotificationsMarkAll /> : null}
      </div>
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className={`px-4 py-3 text-sm ${item.isRead ? "" : "bg-primary/5"}`}>
                {item.link ? (
                  <Link href={item.link} className="font-medium hover:text-primary">{item.title}</Link>
                ) : (
                  <p className="font-medium">{item.title}</p>
                )}
                <p className="text-muted mt-1">{item.message}</p>
                <p className="text-xs text-muted mt-1">{item.type} · {formatDate(item.createdAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
