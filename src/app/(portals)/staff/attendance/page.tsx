import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StaffSelfCheckin } from "@/components/hr/staff-self-checkin";
import {
  canSelfCheckIn,
  getApprovedLeaveUserIds,
} from "@/lib/staff-attendance";
import { redirect } from "next/navigation";

export default async function StaffAttendanceSelfPage() {
  const session = await getSession();
  if (!session || !canSelfCheckIn(session) || !session.schoolId) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const [existing, onLeaveIds] = await Promise.all([
    prisma.staffAttendanceRecord.findUnique({
      where: {
        userId_date: { userId: session.userId, date: today },
      },
    }),
    getApprovedLeaveUserIds(session.schoolId, today),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-muted text-sm mt-1">
          Check in for today ({todayStr})
        </p>
      </div>
      <StaffSelfCheckin
        today={todayStr}
        existing={
          existing
            ? { status: existing.status, checkIn: existing.checkIn }
            : null
        }
        onApprovedLeave={onLeaveIds.has(session.userId)}
      />
    </div>
  );
}
