import { jwtVerify } from "jose";
import { UserRole } from "@prisma/client";
import { resolveAuthSecret } from "./auth-secret";

/** Edge-safe cookie name. Middleware must not import `auth.ts` (prisma/bcrypt/db). */
export const SESSION_COOKIE_NAME = "schoolhub_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  firstName: string;
  lastName: string;
  permissionGrants?: string[];
  permissionDenies?: string[];
  mustResetPassword?: boolean;
  disabledModules?: string[];
  sessionVersion?: number;
}

export function jwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret());
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretBytes());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(
  cookieHeader: string | null
): Promise<SessionPayload | null> {
  if (!cookieHeader) return Promise.resolve(null);
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return Promise.resolve(null);
  try {
    return verifyToken(decodeURIComponent(match[1]));
  } catch {
    return verifyToken(match[1]);
  }
}
