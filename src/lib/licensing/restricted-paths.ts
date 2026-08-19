export const LICENSE_ALLOWED_WHEN_RESTRICTED = [
  "/admin/settings/licence",
  "/admin/settings/backup",
  "/admin/system-health",
  "/account/password",
  "/api/license",
  "/api/backups",
  "/api/auth",
  "/api/notifications",
  "/api/school",
  "/login",
  "/contact",
];

export function isRestrictedPathAllowed(pathname: string, method: string): boolean {
  if (method === "GET" && pathname.startsWith("/api/license")) return true;
  if (pathname.startsWith("/api/backups") && ["GET", "POST"].includes(method)) return true;
  if (pathname.startsWith("/admin/settings/licence")) return true;
  if (pathname.startsWith("/admin/settings/licence-server")) return true;
  if (pathname.startsWith("/api/license-server")) return true;
  if (pathname.startsWith("/admin/settings/backup")) return true;
  if (pathname.startsWith("/account/password")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/login" || pathname === "/contact") return true;
  if (pathname.startsWith("/api/notifications")) return true;
  return LICENSE_ALLOWED_WHEN_RESTRICTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
