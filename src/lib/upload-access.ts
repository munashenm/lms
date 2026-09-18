import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./session";
import { canAccessSchool, isLearnerRole, sessionHasPermission } from "./rbac";
import { canApplyForLeave } from "./staff-leave-access";

export function parseUploadPath(pathname: string): { schoolId: string; rest: string } | null {
  if (pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return null;
  const match = pathname.match(/^\/uploads\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { schoolId: match[1], rest: match[2] };
}

/** Public website artwork only — learner files stay authenticated. */
export function isPublicUploadPath(pathname: string): boolean {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return false;
  return parsed.rest.startsWith("branding/");
}

function topFolder(rest: string): string {
  return rest.split("/")[0] ?? "";
}

export function canAccessUploadPath(session: SessionPayload, pathname: string): boolean {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return false;
  if (isPublicUploadPath(pathname)) return true;
  if (!canAccessSchool(session, parsed.schoolId)) return false;

  const folder = topFolder(parsed.rest);

  if (folder === "branding") return true;

  if (folder === "students") {
    return (
      sessionHasPermission(session, "students:read") ||
      session.role === UserRole.STUDENT ||
      session.role === UserRole.PARENT
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
    return (
      sessionHasPermission(session, "hr.leave.manage") ||
      sessionHasPermission(session, "hr.leave.approve") ||
      canApplyForLeave(session.role) ||
      session.role === UserRole.STUDENT ||
      session.role === UserRole.PARENT
    );
  }

  if (folder === "expenses" || folder === "income") {
    if (isLearnerRole(session.role)) return false;
    return (
      sessionHasPermission(session, "finance:read") ||
      sessionHasPermission(session, "finance.view") ||
      sessionHasPermission(session, "finance.expenses.manage")
    );
  }

  if (folder === "applications") {
    if (isLearnerRole(session.role)) return false;
    return sessionHasPermission(session, "students:read") || sessionHasPermission(session, "students:write");
  }

  if (folder === "submissions") {
    return (
      sessionHasPermission(session, "classes:read") ||
      sessionHasPermission(session, "students:read") ||
      session.role === UserRole.STUDENT ||
      session.role === UserRole.PARENT
    );
  }

  // Library documents live at /uploads/{schoolId}/{filename} with no folder.
  return (
    sessionHasPermission(session, "classes:read") ||
    session.role === UserRole.STUDENT ||
    session.role === UserRole.PARENT
  );
}
