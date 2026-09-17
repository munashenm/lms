import type { SessionPayload } from "./auth";
import { canAccessSchool } from "./rbac";

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

export function canAccessUploadPath(session: SessionPayload, pathname: string): boolean {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return false;
  if (isPublicUploadPath(pathname)) return true;
  return canAccessSchool(session, parsed.schoolId);
}
