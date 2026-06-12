import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffAttendanceMarker } from "@/components/hr/staff-attendance-marker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  canMarkStaffAttendance,
  getApprovedLeaveUserIds,
  getStaffMembersForSchool,
} from "@/lib/staff-attendance";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function StaffAttendancePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.schoolId || !canMarkStaffAttendance(session.role)) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;
  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  const [staffMembers, existingRecords, onLeaveIds, recentRecords] =
    await Promise.all([
      getStaffMembersForSchool(session.schoolId),
      prisma.staffAttendanceRecord.findMany({
        where: { schoolId: session.schoolId, date: attendanceDate },
      }),
      getApprovedLeaveUserIds(session.schoolId, attendanceDate),
      prisma.staffAttendanceRecord.findMany({
        where: { schoolId: session.schoolId },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
    ]);

  const staff = staffMembers.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    role: s.role,
    employeeNumber: s.teacher?.employeeNumber ?? null,
    department: s.teacher?.department ?? null,
    onApprovedLeave: onLeaveIds.has(s.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Attendance</h1>
        <p className="text-muted text-sm mt-1">
          Mark daily attendance for teachers and office staff
        </p>
      </div>

      <form method="GET" className="flex gap-2 items-end">
        <div>
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
          />
        </div>
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium"
        >
          Load
        </button>
      </form>

      {staff.length > 0 ? (
        <StaffAttendanceMarker
          date={date}
          staff={staff}
          existingRecords={existingRecords.map((r) => ({
            userId: r.userId,
            status: r.status,
            checkIn: r.checkIn,
          }))}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No active staff members found for this school.
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Records</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentRecords.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted text-center">
                  No staff attendance recorded yet.
                </p>
              )}
              {recentRecords.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {r.user.firstName} {r.user.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(r.date)}
                      {r.checkIn ? ` · ${r.checkIn}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      r.status === "PRESENT" || r.status === "REMOTE"
                        ? "success"
                        : r.status === "ABSENT"
                          ? "danger"
                          : r.status === "LATE"
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {r.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
