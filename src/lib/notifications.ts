import { CommunicationChannel, CommunicationStatus, NotificationType, UserRole } from "@prisma/client";
import { prisma } from "./db";
import { logCommunication } from "./communications";
import { sendEmailViaSendGrid, sendSmsViaTwilio } from "./outbound-messaging";
import {
  getResolvedIntegrations,
  isSendGridReady,
  isTwilioReady,
} from "./school-integrations";

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

export interface OutboundResult {
  sent: boolean;
  reason?: string;
  httpStatus?: number | null;
  messageId?: string | null;
}

/**
 * Sends email/SMS when credentials are configured.
 * Logs outcome only. Message bodies that contain passwords are not stored.
 * SendGrid acceptance is not the same as a mailbox delivery event.
 */
export async function sendOutboundMessage(
  schoolId: string | null | undefined,
  channel: "email" | "sms",
  to: string,
  subject: string,
  body: string,
  options?: { sensitive?: boolean }
): Promise<OutboundResult> {
  const sensitive = options?.sensitive === true;
  const baseLog = { schoolId: schoolId ?? null, channel, to, subject, bodyLength: body.length };
  const config = await getResolvedIntegrations(schoolId);

  try {
    if (channel === "email") {
      if (!isSendGridReady(config)) {
        const reason = config.sendgrid.apiKey
          ? config.sendgrid.senderValid
            ? "not_configured"
            : "invalid_sender"
          : "not_configured";
        console.info(`[outbound:email]`, JSON.stringify({ ...baseLog, outcome: reason }));
        await recordEmailLog(schoolId, to, subject, body, sensitive, {
          status: CommunicationStatus.LOGGED,
          error: reason === "invalid_sender" ? "Sender address is not a verified mailbox" : "Email provider not configured",
        });
        return { sent: false, reason };
      }
      const { htmlForSchoolEmail } = await import("./email-brand");
      const html = await htmlForSchoolEmail({
        schoolId,
        title: subject,
        bodyText: body,
      });
      const result = await sendEmailViaSendGrid(config, to, subject, body, undefined, html);
      if (!result.sent) {
        console.info(`[outbound:email]`, JSON.stringify({ ...baseLog, outcome: result.reason }));
        await recordEmailLog(schoolId, to, subject, body, sensitive, {
          status: CommunicationStatus.FAILED,
          error: result.reason,
        });
        return { sent: false, reason: result.reason };
      }
      console.info(
        `[outbound:email]`,
        JSON.stringify({ ...baseLog, outcome: "accepted", messageId: result.messageId ?? null })
      );
      await recordEmailLog(schoolId, to, subject, body, sensitive, {
        status: CommunicationStatus.SENT,
        providerMessageId: result.messageId ?? null,
      });
      return { sent: true, messageId: result.messageId ?? null };
    }
    if (channel === "sms" && isTwilioReady(config)) {
      const result = await sendSmsViaTwilio(config, to, body);
      console.info(`[outbound:sms]`, JSON.stringify({ ...baseLog, outcome: result.sent ? "accepted" : result.reason }));
      return result.sent ? { sent: true } : { sent: false, reason: result.reason };
    }
  } catch (err) {
    const httpStatus =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : null;
    const reason = err instanceof Error ? err.message.slice(0, 180) : "delivery_failed";
    console.error(`[outbound:${channel}]`, JSON.stringify({ ...baseLog, outcome: "failed", httpStatus, reason }));
    if (channel === "email") {
      await recordEmailLog(schoolId, to, subject, body, sensitive, {
        status: CommunicationStatus.FAILED,
        error: reason,
      });
    }
    return { sent: false, reason, httpStatus };
  }

  console.info(`[outbound:${channel}]`, JSON.stringify({ ...baseLog, outcome: "not_configured" }));
  return { sent: false, reason: "not_configured" };
}

async function recordEmailLog(
  schoolId: string | null | undefined,
  to: string,
  subject: string,
  body: string,
  sensitive: boolean,
  result: {
    status: CommunicationStatus;
    error?: string;
    providerMessageId?: string | null;
  }
) {
  if (!schoolId) return;
  const message = sensitive
    ? "Transactional email sent. The message body is not stored because it may contain a password."
    : body;
  await logCommunication({
    schoolId,
    channel: CommunicationChannel.EMAIL,
    category: "GENERAL",
    status: result.status,
    recipientContact: to,
    subject,
    message,
    error: result.error ?? null,
    provider: "sendgrid",
    providerMessageId: result.providerMessageId ?? null,
    metadata: { sensitive, acceptedByProvider: result.status === CommunicationStatus.SENT },
  });
}

/** @deprecated Use sendOutboundMessage */
export const logOutboundMessage = sendOutboundMessage;
