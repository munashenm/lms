import type { SessionPayload } from "./auth";
import { getTeacherForSession } from "./portal-data";
import { prisma } from "./db";

export { STAFF_LEAVE_ROLES, canApplyForLeave } from "./staff-leave-access";

export {
  LEAVE_EVIDENCE_ACCEPT,
  LEAVE_EVIDENCE_MAX_BYTES,
  LEAVE_EVIDENCE_TYPES,
  SICK_NOTE_MAX_BYTES,
  SICK_NOTE_TYPES,
  isAllowedLeaveEvidence,
  leaveEvidenceFileFromForm,
  leaveEvidenceLabel,
  leaveEvidenceRequired,
  validateLeaveEvidence,
} from "./staff-leave-evidence";
export type { LeaveEvidenceInput } from "./staff-leave-evidence";

export async function getStaffLeaveApplicant(session: SessionPayload) {
  if (!session.schoolId) return null;

  const [teacher, employee] = await Promise.all([
    getTeacherForSession(session),
    prisma.employee.findFirst({
      where: { userId: session.userId, schoolId: session.schoolId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true },
    }),
  ]);

  return {
    userId: session.userId,
    schoolId: session.schoolId,
    teacherId: teacher?.id ?? null,
    employeeId: employee?.id ?? null,
    firstName: employee?.firstName ?? teacher?.firstName ?? session.firstName,
    lastName: employee?.lastName ?? teacher?.lastName ?? session.lastName,
    employeeNumber: employee?.employeeNumber ?? teacher?.employeeNumber ?? null,
    department: employee?.department ?? teacher?.department ?? null,
  };
}
