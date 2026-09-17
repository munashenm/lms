import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import {
  SESSION_COOKIE_NAME,
  getSessionFromRequest,
  jwtSecretBytes,
  verifyToken,
  type SessionPayload,
} from "./session";

export type { SessionPayload };
export { getSessionFromRequest, SESSION_COOKIE_NAME, verifyToken };

const SESSION_DURATION = "8h";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: SessionPayload): Promise<string> {
  const safe = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    schoolId: payload.schoolId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    mustResetPassword: payload.mustResetPassword ?? false,
    sessionVersion: payload.sessionVersion ?? 1,
  };
  return new SignJWT(safe)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(jwtSecretBytes());
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return attachLiveAccess(payload);
}

async function attachLiveAccess(payload: SessionPayload): Promise<SessionPayload | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        isActive: true,
        role: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        email: true,
        permissionGrants: true,
        permissionDenies: true,
        mustResetPassword: true,
        sessionVersion: true,
      },
    });
    if (!user?.isActive) return null;
    const tokenVersion = payload.sessionVersion ?? 1;
    if (user.sessionVersion !== tokenVersion) return null;
    const disabledModules = user.schoolId
      ? (
          await prisma.schoolModule.findMany({
            where: { schoolId: user.schoolId, enabled: false },
            select: { moduleKey: true },
          })
        ).map((row) => row.moduleKey)
      : [];
    return {
      userId: payload.userId,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
      permissionGrants: user.permissionGrants,
      permissionDenies: user.permissionDenies,
      mustResetPassword: user.mustResetPassword,
      sessionVersion: user.sessionVersion,
      disabledModules,
    };
  } catch {
    return null;
  }
}

export async function bumpSessionVersion(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return user.sessionVersion;
}

export async function issueSession(payload: SessionPayload): Promise<void> {
  const token = await createToken(payload);
  await setSessionCookie(token);
}
