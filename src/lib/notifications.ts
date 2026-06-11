import { NotificationType, UserRole } from "@prisma/client";
import { prisma } from "./db";

interface NotifyUserParams {
  userId: string;
  schoolId?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export async function notifyUser(params: NotifyUserParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      schoolId: params.schoolId ?? undefined,
      title: params.title,
      message: params.message,
      type: params.type ?? "INFO",
      link: params.link,
    },
  });
}

export async function notifySchoolRoles(params: {
  schoolId: string;
  roles: UserRole[];
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}) {
  const users = await prisma.user.findMany({
    where: { schoolId: params.schoolId, role: { in: params.roles }, isActive: true },
    select: { id: true },
  });

  if (users.length === 0) return [];

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      schoolId: params.schoolId,
      title: params.title,
      message: params.message,
      type: params.type ?? "INFO",
      link: params.link,
    })),
  });

  return users;
}

export async function notifyStudentGuardians(params: {
  studentId: string;
  schoolId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}) {
  const links = await prisma.studentGuardian.findMany({
    where: { studentId: params.studentId },
    include: { guardian: { select: { userId: true } } },
  });

  const userIds = links
    .map((l) => l.guardian.userId)
    .filter((id): id is string => Boolean(id));

  if (userIds.length === 0) return [];

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      schoolId: params.schoolId,
      title: params.title,
      message: params.message,
      type: params.type ?? "INFO",
      link: params.link,
    })),
  });

  return userIds;
}

/** Logs email/SMS intent — wire to SendGrid/Twilio in production */
export function logOutboundMessage(channel: "email" | "sms", to: string, subject: string, body: string) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[${channel.toUpperCase()}] To: ${to} | ${subject} | ${body.slice(0, 80)}...`);
  }
}
