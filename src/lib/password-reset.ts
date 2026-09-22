import crypto from "crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { sendOutboundMessage } from "./notifications";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export type PortalCredentialRole = "student" | "parent" | "staff";

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Readable temporary password for welcome emails (user must change on first login). */
export function generateTemporaryPassword(): string {
  const digits = crypto.randomInt(1000, 9999);
  const suffix = crypto.randomBytes(2).toString("hex").slice(0, 2);
  return `Learn@${digits}${suffix}`;
}

export async function issuePortalCredentials(params: {
  userId: string;
  schoolId: string | null;
  email: string;
  firstName: string;
  role: PortalCredentialRole;
  studentNumber?: string | null;
}) {
  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      mustResetPassword: true,
      sessionVersion: { increment: 1 },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const loginPath =
    params.role === "parent"
      ? "/parent/login"
      : params.role === "staff"
        ? "/staff/login"
        : "/student/login";
  const loginUrl = `${appUrl}${loginPath}`;

  const school = params.schoolId
    ? await prisma.school.findUnique({ where: { id: params.schoolId }, select: { name: true } })
    : null;
  const schoolName = school?.name ?? "your school";

  const subject = `Your ${schoolName} portal login`;
  let body = `Hi ${params.firstName},\n\nYour portal account is ready.\n\n`;
  body += `Login email: ${params.email}\n`;
  if (params.role === "student" && params.studentNumber?.trim()) {
    body += `Student ID: ${params.studentNumber.trim()}\n`;
  }
  body += `Temporary password: ${tempPassword}\n\n`;
  body += `Sign in at: ${loginUrl}\n\n`;
  body += `Please change your password after your first login.\n\n`;
  body += `If you were not expecting this email, contact ${schoolName}.`;

  await sendOutboundMessage(params.schoolId, "email", params.email, subject, body);
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issuePasswordSetup(params: {
  userId: string;
  schoolId: string | null;
  email: string;
  firstName: string;
  kind: "reset" | "welcome_student" | "welcome_parent" | "welcome_staff";
}) {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expires,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const setupUrl = `${appUrl}/reset-password?token=${token}`;
  const portal =
    params.kind === "welcome_parent" ? "parent" : params.kind === "welcome_staff" ? "staff" : "student";
  const subject =
    params.kind === "reset"
      ? "Reset your SchoolHub SA password"
      : "Set up your SchoolHub SA portal password";
  const body =
    params.kind === "reset"
      ? `Hi ${params.firstName},\n\nUse this link to reset your password (valid for 1 hour):\n${setupUrl}\n\nIf you did not request this, you can ignore this email.`
      : `Hi ${params.firstName},\n\nA ${portal} portal account was created for you. Set your password using this link (valid for 1 hour):\n${setupUrl}\n\nIf you were not expecting this, contact your school.`;

  await sendOutboundMessage(params.schoolId, "email", params.email, subject, body);
}

export async function createPasswordResetRequest(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, schoolId: true, firstName: true, isActive: true },
  });

  if (!user?.isActive) {
    return { sent: true as const };
  }

  await issuePasswordSetup({
    userId: user.id,
    schoolId: user.schoolId,
    email: user.email,
    firstName: user.firstName,
    kind: "reset",
  });

  return { sent: true as const };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashResetToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { gt: new Date() },
      isActive: true,
    },
  });

  if (!user) {
    return { ok: false as const, reason: "invalid_or_expired" };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      mustResetPassword: false,
      sessionVersion: { increment: 1 },
    },
  });

  return { ok: true as const };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, reason: "not_found" };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { ok: false as const, reason: "invalid_current" };

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      mustResetPassword: false,
      sessionVersion: { increment: 1 },
    },
    select: {
      id: true,
      email: true,
      role: true,
      schoolId: true,
      firstName: true,
      lastName: true,
      sessionVersion: true,
      mustResetPassword: true,
    },
  });

  return { ok: true as const, user: updated };
}
