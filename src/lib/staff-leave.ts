import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";
import { getTeacherForSession } from "./portal-data";
import { prisma } from "./db";

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

export const STAFF_LEAVE_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.SUPER_ADMIN,
  UserRole.STAFF,
];

export function canApplyForLeave(role: UserRole): boolean {
  return STAFF_LEAVE_ROLES.includes(role);
}

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

export async function saveLeaveEvidenceFile(
  schoolId: string,
  file: File
): Promise<{ url: string; filename: string }> {
  const bytes = await file.arrayBuffer();
  const uploadsDir = path.join(process.cwd(), "public", "uploads", schoolId, "leave");
  await mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
  return {
    url: `/uploads/${schoolId}/leave/${filename}`,
    filename: file.name,
  };
}
