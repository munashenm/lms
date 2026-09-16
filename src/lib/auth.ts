import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { prisma } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "schoolhub-dev-secret-change-in-production"
);

const COOKIE_NAME = "schoolhub_session";
const SESSION_DURATION = "8h";

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
}

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
  const { permissionGrants: _g, permissionDenies: _d, mustResetPassword: _m, ...safe } = payload;
  return new SignJWT({ ...safe })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
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
      },
    });
    if (!user?.isActive) return null;
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
      disabledModules,
    };
  } catch {
    return payload;
  }
}

export function getSessionFromRequest(
  cookieHeader: string | null
): Promise<SessionPayload | null> {
  if (!cookieHeader) return Promise.resolve(null);
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return Promise.resolve(null);
  return verifyToken(match[1]);
}
