import {
  CommunicationBatchStatus,
  CommunicationCategory,
  CommunicationChannel,
  CommunicationStatus,
  StudentStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "./db";
import { logCommunication } from "./communications";
import { asInputJson } from "./json";

export type NoticeAudience = "STUDENT" | "CLASS" | "GRADE" | "PARENTS" | "STUDENTS" | "STAFF";
export type NoticeChannel = "EMAIL" | "SMS" | "BOTH";

export type NoticeRecipient = {
  studentId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

export function applyNoticeTemplate(
  template: string,
  vars: { firstName?: string | null; lastName?: string | null }
): string {
  return template
    .replaceAll("{{firstName}}", (vars.firstName ?? "").trim())
    .replaceAll("{{lastName}}", (vars.lastName ?? "").trim());
}

function contactKey(channel: CommunicationChannel, contact: string) {
  return `${channel}:${contact.trim().toLowerCase()}`;
}

export async function resolveNoticeRecipients(params: {
  schoolId: string;
  audience: NoticeAudience;
  studentId?: string | null;
  classId?: string | null;
  gradeId?: string | null;
}): Promise<NoticeRecipient[]> {
  if (params.audience === "STAFF") {
    const users = await prisma.user.findMany({
      where: {
        schoolId: params.schoolId,
        isActive: true,
        role: {
          in: [
            UserRole.TEACHER,
            UserRole.STAFF,
            UserRole.FINANCE_OFFICER,
            UserRole.HR_OFFICER,
            UserRole.ADMISSIONS_OFFICER,
            UserRole.PRINCIPAL,
            UserRole.SCHOOL_ADMIN,
          ],
        },
      },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    return users.map((u) => ({
      studentId: null,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
    }));
  }

  const studentWhere = {
    schoolId: params.schoolId,
    status: StudentStatus.ACTIVE,
    ...(params.audience === "STUDENT" && params.studentId ? { id: params.studentId } : {}),
    ...(params.audience === "CLASS" && params.classId ? { classId: params.classId } : {}),
    ...(params.audience === "GRADE" && params.gradeId ? { gradeId: params.gradeId } : {}),
  };

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      guardians: {
        orderBy: { isPrimary: "desc" },
        take: 2,
        include: {
          guardian: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      },
    },
    take: 500,
  });

  const rows: NoticeRecipient[] = [];

  for (const student of students) {
    if (params.audience === "STUDENTS") {
      rows.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        phone: student.phone,
      });
      continue;
    }

    const guardians = student.guardians.map((g) => g.guardian);
    if (guardians.length === 0) {
      rows.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        phone: student.phone,
      });
      continue;
    }
    for (const guardian of guardians) {
      rows.push({
        studentId: student.id,
        name: `${guardian.firstName} ${guardian.lastName}`,
        email: guardian.email ?? student.email,
        phone: guardian.phone ?? student.phone,
      });
    }
  }

  return rows;
}

export async function createNoticeBatch(params: {
  schoolId: string;
  audience: NoticeAudience;
  channel: NoticeChannel;
  category: CommunicationCategory;
  subject: string;
  message: string;
  studentId?: string | null;
  classId?: string | null;
  gradeId?: string | null;
  createdById?: string | null;
}) {
  const recipients = await resolveNoticeRecipients({
    schoolId: params.schoolId,
    audience: params.audience,
    studentId: params.studentId,
    classId: params.classId,
    gradeId: params.gradeId,
  });

  const channels: CommunicationChannel[] =
    params.channel === "BOTH"
      ? [CommunicationChannel.EMAIL, CommunicationChannel.SMS]
      : params.channel === "SMS"
        ? [CommunicationChannel.SMS]
        : [CommunicationChannel.EMAIL];

  const batch = await prisma.communicationBatch.create({
    data: {
      schoolId: params.schoolId,
      category: params.category,
      channel: channels[0],
      status: CommunicationBatchStatus.PENDING,
      filters: asInputJson({
        audience: params.audience,
        channel: params.channel,
        studentId: params.studentId ?? null,
        classId: params.classId ?? null,
        gradeId: params.gradeId ?? null,
        recipientCount: recipients.length,
      }),
      createdById: params.createdById ?? null,
    },
  });

  const seen = new Set<string>();
  let queued = 0;

  for (const recipient of recipients) {
    const firstName = recipient.name.split(" ")[0];
    const lastName = recipient.name.split(" ").slice(1).join(" ");
    const message = applyNoticeTemplate(params.message, { firstName, lastName });
    const subject = applyNoticeTemplate(params.subject, { firstName, lastName });

    for (const channel of channels) {
      const contact =
        channel === CommunicationChannel.SMS ? recipient.phone : recipient.email;
      if (!contact) {
        await logCommunication({
          schoolId: params.schoolId,
          batchId: batch.id,
          studentId: recipient.studentId,
          channel,
          category: params.category,
          status: CommunicationStatus.FAILED,
          recipientName: recipient.name,
          recipientContact: "missing",
          subject,
          message,
          error:
            channel === CommunicationChannel.SMS
              ? "No phone on file"
              : "No email on file",
          metadata: asInputJson({ audience: params.audience, action: "NOTICE" }),
        });
        continue;
      }
      const key = contactKey(channel, contact);
      if (seen.has(key)) continue;
      seen.add(key);

      await logCommunication({
        schoolId: params.schoolId,
        batchId: batch.id,
        studentId: recipient.studentId,
        channel,
        category: params.category,
        status: CommunicationStatus.QUEUED,
        recipientName: recipient.name,
        recipientContact: contact,
        subject,
        message,
        metadata: asInputJson({ audience: params.audience, action: "NOTICE" }),
      });
      queued += 1;
    }
  }

  const failedCount = await prisma.communicationLog.count({
    where: { batchId: batch.id, status: CommunicationStatus.FAILED },
  });

  return prisma.communicationBatch.update({
    where: { id: batch.id },
    data: {
      totalCount: queued + failedCount,
      queuedCount: queued,
      failedCount,
      status:
        queued > 0 ? CommunicationBatchStatus.PENDING : CommunicationBatchStatus.COMPLETED,
      completedAt: queued > 0 ? null : new Date(),
    },
  });
}
