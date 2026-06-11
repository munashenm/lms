import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnnouncementList } from "@/components/announcements/announcement-list";
import { getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { ClipboardCheck, CreditCard, FileText, Users } from "lucide-react";

export default async function ParentDashboardPage() {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const childIds = guardian?.students.map((sg) => sg.studentId) ?? [];

  const [invoices, attendanceStats, announcements] = await Promise.all([
    childIds.length > 0
      ? prisma.invoice.findMany({
          where: { studentId: { in: childIds }, status: { not: "DRAFT" } },
        })
      : Promise.resolve([]),
    childIds.length > 0
      ? prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { studentId: { in: childIds } },
          _count: true,
        })
      : Promise.resolve([]),
    prisma.announcement.findMany({
      where: {
        ...(session!.schoolId ? { schoolId: session!.schoolId } : {}),
        audience: { in: ["ALL", "PARENTS"] },
      },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { publishAt: "desc" },
      take: 3,
    }),
  ]);

  const outstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const present = attendanceStats.find((a) => a.status === "PRESENT")?._count ?? 0;
  const totalAttendance = attendanceStats.reduce((s, a) => s + a._count, 0);
  const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Welcome, {session!.firstName}. View your children&apos;s progress.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Children"
          value={childIds.length}
          icon={Users}
        />
        <StatCard
          title="Outstanding Fees"
          value={formatZAR(outstanding)}
          icon={CreditCard}
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          subtitle={`Across ${childIds.length} child${childIds.length !== 1 ? "ren" : ""}`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Invoices"
          value={invoices.length}
          icon={FileText}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Children</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {guardian?.students.length ? (
              guardian.students.map((sg) => (
                <div key={sg.studentId} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {sg.student.firstName} {sg.student.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {sg.student.grade?.name ?? "—"}
                      {sg.student.class?.name && ` · ${sg.student.class.name}`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No linked children.</p>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/parent/children">View all</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/parent/fees">Fees</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/parent/attendance">Attendance</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/parent/results">Results</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Latest Announcements</h2>
        <AnnouncementList announcements={announcements} />
      </div>
    </div>
  );
}
