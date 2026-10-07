/**
 * Paths reachable while a school licence is restricted (expired/suspended/revoked).
 * Mutations outside this allowlist must be blocked by requireLicenseWrite / requireLicenseMutation.
 * Read access to ordinary school data remains available via GET handlers that do not mutate.
 */
export const LICENSE_ALLOWED_WHEN_RESTRICTED = [
  "/admin/settings/licence",
  "/admin/settings/licence-server",
  "/admin/licensing",
  "/admin/settings/backup",
  "/admin/system-health",
  "/account/password",
  "/api/license",
  "/api/license-server",
  "/api/backups",
  "/api/restore",
  "/api/auth",
  "/api/notifications",
  "/api/me/profile",
  "/login",
  "/contact",
];

export function isRestrictedPathAllowed(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" && pathname.startsWith("/api/license")) return true;
  if (pathname.startsWith("/api/backups") && ["GET", "POST", "PATCH", "DELETE"].includes(m)) return true;
  if (pathname.startsWith("/api/restore") && ["GET", "POST"].includes(m)) return true;
  if (pathname.startsWith("/admin/settings/licence")) return true;
  if (pathname.startsWith("/admin/settings/licence-server")) return true;
  if (pathname.startsWith("/admin/licensing")) return true;
  if (pathname.startsWith("/api/license-server")) return true;
  if (pathname.startsWith("/admin/settings/backup")) return true;
  if (pathname.startsWith("/account/password")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/me/profile")) return true;
  if (pathname === "/login" || pathname === "/contact") return true;
  if (pathname === "/student/login" || pathname === "/parent/login") return true;
  if (pathname.startsWith("/api/notifications")) return true;
  // GET /api/school is used for branding/settings reads; mutations are guarded in the route.
  if (m === "GET" && (pathname === "/api/school" || pathname.startsWith("/api/school/"))) return true;
  return LICENSE_ALLOWED_WHEN_RESTRICTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
