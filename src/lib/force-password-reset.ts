export const FORCE_PASSWORD_PATH = "/account/password";

const ALLOWED_PREFIXES = [
  FORCE_PASSWORD_PATH,
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

export function isForcedPasswordPathAllowed(pathname: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
