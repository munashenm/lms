import crypto from "crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { sendOutboundMessage } from "./notifications";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetRequest(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, schoolId: true, firstName: true, isActive: true },
  });

  if (!user?.isActive) {
    return { sent: true as const };
  }

  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expires,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendOutboundMessage(
    user.schoolId,
    "email",
    user.email,
    "Reset your SchoolHub SA password",
    `Hi ${user.firstName},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
  );

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
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    },
  });

  return { ok: true as const };
}
