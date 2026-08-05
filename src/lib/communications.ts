import {
  CommunicationCategory,
  CommunicationChannel,
  CommunicationStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { getResolvedIntegrations, isTwilioReady } from "./school-integrations";
import { createTwilioSmsProvider } from "./sms/twilio-provider";
import { sendEmailViaSendGrid } from "./outbound-messaging";
import { isSendGridReady } from "./school-integrations";
import { formatDate } from "./utils";

export async function logCommunication(entry: {
  schoolId: string;
  batchId?: string | null;
  studentId?: string | null;
  channel: CommunicationChannel;
  category: CommunicationCategory;
  status: CommunicationStatus;
  recipientName?: string | null;
  recipientContact: string;
  subject?: string | null;
  message: string;
  error?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.communicationLog.create({
    data: {
      schoolId: entry.schoolId,
      batchId: entry.batchId ?? null,
      studentId: entry.studentId ?? null,
      channel: entry.channel,
      category: entry.category,
      status: entry.status,
      recipientName: entry.recipientName ?? null,
      recipientContact: entry.recipientContact,
      subject: entry.subject ?? null,
      message: entry.message,
      error: entry.error ?? null,
      metadata: entry.metadata,
    },
  });
}

export async function sendLoggedSms(params: {
  schoolId: string;
  studentId?: string | null;
  category: CommunicationCategory;
  recipientName?: string | null;
  recipientContact: string;
  message: string;
  subject?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const config = await getResolvedIntegrations(params.schoolId);
  if (!isTwilioReady(config)) {
    return logCommunication({
      ...params,
      channel: CommunicationChannel.SMS,
      status: CommunicationStatus.LOGGED,
      error: "SMS provider not configured",
    });
  }

  const provider = createTwilioSmsProvider(config);
  try {
    const result = await provider.send(params.recipientContact, params.message);
    return logCommunication({
      ...params,
      channel: CommunicationChannel.SMS,
      status: result.sent ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
      error: result.sent ? null : result.reason,
      metadata: {
        ...(typeof params.metadata === "object" && params.metadata ? params.metadata : {}),
        provider: result.provider,
        externalId: result.sent ? result.externalId : undefined,
      } as Prisma.InputJsonValue,
    });
  } catch (err) {
    return logCommunication({
      ...params,
      channel: CommunicationChannel.SMS,
      status: CommunicationStatus.FAILED,
      error: err instanceof Error ? err.message : "SMS send failed",
    });
  }
}

export async function sendLoggedEmail(params: {
  schoolId: string;
  studentId?: string | null;
  category: CommunicationCategory;
  recipientName?: string | null;
  recipientContact: string;
  subject: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  attachments?: { filename: string; type: string; contentBase64: string }[];
}) {
  const config = await getResolvedIntegrations(params.schoolId);
  if (!isSendGridReady(config)) {
    return logCommunication({
      ...params,
      channel: CommunicationChannel.EMAIL,
      status: CommunicationStatus.LOGGED,
      error: "Email provider not configured",
    });
  }

  try {
    const result = await sendEmailViaSendGrid(
      config,
      params.recipientContact,
      params.subject,
      params.message,
      params.attachments
    );
    return logCommunication({
      ...params,
      channel: CommunicationChannel.EMAIL,
      status: result.sent ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
      error: result.sent ? null : result.reason,
    });
  } catch (err) {
    return logCommunication({
      ...params,
      channel: CommunicationChannel.EMAIL,
      status: CommunicationStatus.FAILED,
      error: err instanceof Error ? err.message : "Email send failed",
    });
  }
}

/** Notify primary guardians by SMS when a learner is marked absent/sick. */
export async function notifyAbsenceAlerts(params: {
  schoolId: string;
  date: string | Date;
  absences: { studentId: string; status: string; notes?: string | null }[];
}) {
  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { id: true, name: true, absenceNotifyEnabled: true },
  });
  if (!school?.absenceNotifyEnabled) return { sent: 0, skipped: true as const };

  const dateLabel =
    typeof params.date === "string"
      ? formatDate(new Date(params.date))
      : formatDate(params.date);

  let sent = 0;

  for (const absence of params.absences) {
    if (absence.status !== "ABSENT" && absence.status !== "SICK") continue;

    const already = await prisma.communicationLog.findFirst({
      where: {
        schoolId: params.schoolId,
        studentId: absence.studentId,
        category: CommunicationCategory.ABSENCE_ALERT,
        channel: CommunicationChannel.SMS,
        createdAt: {
          gte: new Date(new Date(params.date).setHours(0, 0, 0, 0)),
          lt: new Date(new Date(params.date).setHours(23, 59, 59, 999)),
        },
        status: { in: [CommunicationStatus.SENT, CommunicationStatus.QUEUED] },
      },
    });
    if (already) continue;

    const student = await prisma.student.findUnique({
      where: { id: absence.studentId },
      select: {
        firstName: true,
        lastName: true,
        guardians: {
          where: { isPrimary: true },
          include: {
            guardian: { select: { firstName: true, lastName: true, phone: true } },
          },
          take: 3,
        },
      },
    });
    if (!student) continue;

    let recipients = student.guardians
      .map((g) => g.guardian)
      .filter((g) => Boolean(g.phone));

    if (recipients.length === 0) {
      const any = await prisma.studentGuardian.findMany({
        where: { studentId: absence.studentId },
        include: {
          guardian: { select: { firstName: true, lastName: true, phone: true } },
        },
        take: 3,
      });
      recipients = any.map((g) => g.guardian).filter((g) => Boolean(g.phone));
    }

    for (const guardian of recipients) {
      if (!guardian.phone) continue;
      const note = absence.notes ? ` Note: ${absence.notes}` : "";
      const message = `Dear Parent/Guardian, ${student.firstName} ${student.lastName} was marked ${absence.status.toLowerCase()} from school today, ${dateLabel}.${note} Please contact the school if necessary. — ${school.name}`;

      const log = await sendLoggedSms({
        schoolId: params.schoolId,
        studentId: absence.studentId,
        category: CommunicationCategory.ABSENCE_ALERT,
        recipientName: `${guardian.firstName} ${guardian.lastName}`,
        recipientContact: guardian.phone,
        subject: "Absence alert",
        message,
        metadata: { status: absence.status, date: dateLabel },
      });
      if (log.status === CommunicationStatus.SENT) sent += 1;
    }
  }

  return { sent, skipped: false as const };
}
