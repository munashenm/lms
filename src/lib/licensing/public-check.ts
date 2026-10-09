/** Machine heartbeat. Authenticated by the licence key, not a user session. */
export function isPublicLicenseCheck(pathname: string, method: string): boolean {
  return method.toUpperCase() === "POST" && pathname === "/api/license-server/v1/licenses/check";
}
