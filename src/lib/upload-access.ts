import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./session";
import { canAccessSchool, isLearnerRole, sessionHasPermission } from "./rbac";
import { canApplyForLeave } from "./staff-leave-access";
import { prisma } from "./db";
import { documentVisibleToLearner } from "./learner-portal";
import {
  isPublicUploadPath,
  looksLikeEntityId,
  parseUploadPath,
  topUploadFolder,
  uploadPathSegments,
} from "./upload-path";

export { isPublicUploadPath, parseUploadPath } from "./upload-path";

export type UploadOwnershipContext = {
  studentId?: string | null;
  childStudentIds?: string[];
  /** When true, skip Document DB lookup (unit tests). */
  skipLibraryLookup?: boolean;
  /** Pre-resolved library visibility for tests. */
  libraryAllowed?: boolean;
};

async function resolveOwnership(
  session: SessionPayload,
  ownership?: UploadOwnershipContext
): Promise<{ studentId: string | null; childStudentIds: string[] }> {
  if (ownership) {
    return {
      studentId: ownership.studentId ?? null,
      childStudentIds: ownership.childStudentIds ?? [],
    };
  }
  if (session.role === UserRole.STUDENT) {
    const student = await prisma.student.findFirst({
      where: {
        userId: session.userId,
        ...(session.schoolId ? { schoolId: session.schoolId } : {}),
      },
      select: { id: true },
    });
    return { studentId: student?.id ?? null, childStudentIds: [] };
  }
  if (session.role === UserRole.PARENT) {
    const guardian = await prisma.guardian.findFirst({
      where: {
        userId: session.userId,
        ...(session.schoolId ? { schoolId: session.schoolId } : {}),
      },
      select: { students: { select: { studentId: true } } },
    });
    return {
      studentId: null,
      childStudentIds: guardian?.students.map((s) => s.studentId) ?? [],
    };
  }
  return { studentId: null, childStudentIds: [] };
}

function learnerOwnsStudent(
  role: UserRole,
  targetStudentId: string,
  ownership: { studentId: string | null; childStudentIds: string[] }
): boolean {
  if (role === UserRole.STUDENT) {
    return Boolean(ownership.studentId && ownership.studentId === targetStudentId);
  }
  if (role === UserRole.PARENT) {
    return ownership.childStudentIds.includes(targetStudentId);
  }
  return false;
}

async function canAccessLibraryDocument(
  session: SessionPayload,
  pathname: string,
  ownership: UploadOwnershipContext | undefined,
  resolved: { studentId: string | null; childStudentIds: string[] }
): Promise<boolean> {
  if (ownership?.skipLibraryLookup) {
    return ownership.libraryAllowed === true;
  }
  if (
    (sessionHasPermission(session, "classes:read") || sessionHasPermission(session, "students:read")) &&
    !isLearnerRole(session.role)
  ) {
    return true;
  }
  if (!isLearnerRole(session.role)) return false;

  const doc = await prisma.document.findFirst({
    where: { fileUrl: pathname, schoolId: session.schoolId ?? undefined },
    select: {
      isPublic: true,
      learnerVisible: true,
      targetStudentId: true,
      targetClassId: true,
      targetGradeId: true,
      targetCampusId: true,
      targetCourseId: true,
    },
  });
  if (!doc) return false;

  if (session.role === UserRole.PARENT) {
    return doc.isPublic === true;
  }

  if (session.role === UserRole.STUDENT && resolved.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: resolved.studentId },
      select: {
        id: true,
        gradeId: true,
        classId: true,
        campusId: true,
        enrolments: { select: { courseId: true } },
      },
    });
    if (!student) return false;
    return documentVisibleToLearner(doc, {
      id: student.id,
      gradeId: student.gradeId,
      classId: student.classId,
      campusId: student.campusId,
      courseIds: student.enrolments
        .map((e) => e.courseId)
        .filter((id): id is string => Boolean(id)),
    });
  }
  return false;
}

/**
 * Authorise access to /uploads/{schoolId}/... paths.
 * Cross-school access is always denied for school-bound users.
 * Learner roles require per-learner ownership for private folders.
 */
export async function canAccessUploadPath(
  session: SessionPayload,
  pathname: string,
  ownership?: UploadOwnershipContext
): Promise<boolean> {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return false;
  if (isPublicUploadPath(pathname)) return true;
  if (!canAccessSchool(session, parsed.schoolId)) return false;

  const folder = topUploadFolder(parsed.rest);
  const segments = uploadPathSegments(parsed.rest);

  if (folder === "branding") return true;

  if (folder === "visitors") {
    if (isLearnerRole(session.role)) return false;
    return sessionHasPermission(session, "visitors:read") || sessionHasPermission(session, "gate:read");
  }

  if (folder === "students") {
    const targetStudentId = segments[1];
    if (!looksLikeEntityId(targetStudentId)) return false;
    const filename = segments[segments.length - 1] ?? "";
    if (
      /\.(jpe?g|png)$/i.test(filename) &&
      (sessionHasPermission(session, "gate:scan") || sessionHasPermission(session, "gate:read"))
    ) {
      return true;
    }
    if (sessionHasPermission(session, "students:read") && !isLearnerRole(session.role)) {
      return true;
    }
    const resolved = await resolveOwnership(session, ownership);
    return learnerOwnsStudent(session.role, targetStudentId, resolved);
  }

  if (folder === "submissions") {
    const targetStudentId = segments[1];
    if (looksLikeEntityId(targetStudentId)) {
      if (
        !isLearnerRole(session.role) &&
        (sessionHasPermission(session, "classes:read") ||
          sessionHasPermission(session, "students:read") ||
          sessionHasPermission(session, "homework.grade") ||
          sessionHasPermission(session, "marks:write"))
      ) {
        return true;
      }
      const resolved = await resolveOwnership(session, ownership);
      return learnerOwnsStudent(session.role, targetStudentId, resolved);
    }
    // Legacy flat submissions: staff only
    if (isLearnerRole(session.role)) return false;
    return (
      sessionHasPermission(session, "classes:read") ||
      sessionHasPermission(session, "students:read") ||
      sessionHasPermission(session, "homework.grade") ||
      sessionHasPermission(session, "marks:write")
    );
  }

  if (folder === "applications") {
    if (isLearnerRole(session.role)) return false;
    return sessionHasPermission(session, "students:read") || sessionHasPermission(session, "students:write");
  }

  if (folder === "payments" || folder === "expenses" || folder === "income") {
    if (isLearnerRole(session.role)) return false;
    return (
      sessionHasPermission(session, "finance:read") ||
      sessionHasPermission(session, "finance.view") ||
      sessionHasPermission(session, "finance.expenses.manage") ||
      sessionHasPermission(session, "finance.payments.create")
    );
  }

  if (folder === "hr") {
    return (
      sessionHasPermission(session, "hr.view") ||
      sessionHasPermission(session, "hr.documents.manage") ||
      sessionHasPermission(session, "staff:read")
    );
  }

  if (folder === "leave") {
    const maybeStudentId = segments[1];
    if (looksLikeEntityId(maybeStudentId)) {
      if (
        !isLearnerRole(session.role) &&
        (sessionHasPermission(session, "hr.leave.manage") ||
          sessionHasPermission(session, "hr.leave.approve") ||
          sessionHasPermission(session, "students:read"))
      ) {
        return true;
      }
      const resolved = await resolveOwnership(session, ownership);
      return learnerOwnsStudent(session.role, maybeStudentId, resolved);
    }
    if (isLearnerRole(session.role)) return false;
    return (
      sessionHasPermission(session, "hr.leave.manage") ||
      sessionHasPermission(session, "hr.leave.approve") ||
      canApplyForLeave(session.role)
    );
  }

  if (folder === "messages") {
    if (isLearnerRole(session.role)) {
      const ownerUserId = segments[1];
      return Boolean(ownerUserId && ownerUserId === session.userId);
    }
    return (
      sessionHasPermission(session, "messaging.view") ||
      sessionHasPermission(session, "messaging.send") ||
      sessionHasPermission(session, "classes:read")
    );
  }

  const resolved = await resolveOwnership(session, ownership);
  return canAccessLibraryDocument(session, pathname, ownership, resolved);
}
