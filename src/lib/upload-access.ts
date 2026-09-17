import path from "path";
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

export function resolveSafeUploadRestoreDest(
  relativePath: string,
  cwd = process.cwd()
): string | null {
  if (!relativePath || relativePath.includes("\0")) return null;
  const posix = relativePath.replace(/\\/g, "/");
  if (!posix.startsWith("uploads/")) return null;
  const normalized = path.posix.normalize(posix);
  if (normalized !== "uploads" && !normalized.startsWith("uploads/")) return null;
  if (normalized.split("/").includes("..")) return null;
  const dest = path.resolve(cwd, "public", ...normalized.split("/"));
  const root = path.resolve(cwd, "public", "uploads");
  if (dest !== root && !dest.startsWith(root + path.sep)) return null;
  return dest;
}
