import { LeaveStatus, UserRole } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { STAFF_LEAVE_ROLES } from "./staff-leave";

export const STAFF_ATTENDANCE_ROLES = STAFF_LEAVE_ROLES;

export function canTrackStaffAttendance(role: UserRole): boolean {
  return STAFF_ATTENDANCE_ROLES.includes(role);
}

export function canMarkStaffAttendance(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.SCHOOL_ADMIN ||
    role === UserRole.PRINCIPAL
  );
}

export async function getStaffMembersForSchool(schoolId: string) {
  return prisma.user.findMany({
    where: {
      schoolId,
      role: { in: STAFF_ATTENDANCE_ROLES },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      teacher: { select: { employeeNumber: true, department: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getApprovedLeaveUserIds(
  schoolId: string,
  date: Date
): Promise<Set<string>> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const onLeave = await prisma.leaveRequest.findMany({
    where: {
      schoolId,
      status: LeaveStatus.APPROVED,
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    select: { userId: true },
  });

  return new Set(onLeave.map((r) => r.userId));
}

export function currentTimeHHMM(): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function canSelfCheckIn(session: SessionPayload): boolean {
  return canTrackStaffAttendance(session.role);
}
