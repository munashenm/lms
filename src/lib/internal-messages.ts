import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { logAudit } from "./audit";
import { notifyUser } from "./notifications";
import { ROLE_MESSAGES } from "./constants";
import { saveSchoolUpload } from "./homework-upload";

export async function unreadMessageCount(userId: string) {
  return prisma.messageRecipient.count({
    where: { userId, readAt: null, archivedAt: null },
  });
}

export async function resolveMessageUserIds(opts: {
  schoolId: string;
  senderRole: UserRole;
  userIds?: string[];
  classId?: string | null;
  gradeId?: string | null;
  department?: string | null;
  audience?: "USERS" | "CLASS" | "GRADE" | "STAFF" | "DEPARTMENT";
}) {
  if (opts.audience === "DEPARTMENT" && opts.department) {
    const staff = await prisma.teacher.findMany({
      where: {
        schoolId: opts.schoolId,
        userId: { not: null },
        department: { equals: opts.department, mode: "insensitive" },
      },
      select: { userId: true },
    });
    return staff.map((row) => row.userId!).filter(Boolean);
  }

  if (opts.audience === "STAFF") {
    const staff = await prisma.user.findMany({
      where: {
        schoolId: opts.schoolId,
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
      select: { id: true },
    });
    return staff.map((u) => u.id);
  }

  if (opts.audience === "CLASS" && opts.classId) {
    const students = await prisma.student.findMany({
      where: { schoolId: opts.schoolId, classId: opts.classId, userId: { not: null } },
      select: { userId: true },
    });
    const guardians = await prisma.guardian.findMany({
      where: {
        schoolId: opts.schoolId,
        userId: { not: null },
        students: { some: { student: { classId: opts.classId, schoolId: opts.schoolId } } },
      },
      select: { userId: true },
    });
    return [
      ...students.map((s) => s.userId!).filter(Boolean),
      ...guardians.map((g) => g.userId!).filter(Boolean),
    ];
  }

  if (opts.audience === "GRADE" && opts.gradeId) {
    const students = await prisma.student.findMany({
      where: { schoolId: opts.schoolId, gradeId: opts.gradeId, userId: { not: null } },
      select: { userId: true },
    });
    return students.map((s) => s.userId!).filter(Boolean);
  }

  const ids = [...new Set((opts.userIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const teacherOnly = opts.senderRole === UserRole.TEACHER;
  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      OR: [{ schoolId: opts.schoolId }, { schoolId: null }],
      ...(teacherOnly ? { role: { in: [UserRole.STUDENT, UserRole.PARENT] } } : {}),
    },
    select: { id: true, schoolId: true },
  });
  return users.filter((u) => !u.schoolId || u.schoolId === opts.schoolId).map((u) => u.id);
}

export async function sendInternalMessage(opts: {
  schoolId: string;
  senderId: string;
  subject: string;
  body: string;
  recipientUserIds: string[];
  threadId?: string | null;
  attachment?: File | null;
}) {
  const unique = [...new Set(opts.recipientUserIds.filter((id) => id && id !== opts.senderId))];
  if (unique.length === 0) throw new Error("Select at least one recipient");

  let attachmentUrl: string | null = null;
  if (opts.attachment && opts.attachment.size > 0) {
    attachmentUrl = await saveSchoolUpload({
      schoolId: opts.schoolId,
      folder: "messages",
      file: opts.attachment,
      ownerId: opts.senderId,
    });
  }

  const message = await prisma.internalMessage.create({
    data: {
      schoolId: opts.schoolId,
      senderId: opts.senderId,
      subject: opts.subject.trim(),
      body: opts.body.trim(),
      threadId: opts.threadId || null,
      attachmentUrl,
      recipients: { create: unique.map((userId) => ({ userId })) },
    },
  });

  await logAudit({
    schoolId: opts.schoolId,
    userId: opts.senderId,
    action: unique.length > 1 ? "MESSAGE_BULK_SENT" : "MESSAGE_SENT",
    entity: "InternalMessage",
    entityId: message.id,
    metadata: { recipientCount: unique.length, subject: opts.subject },
  });

  const recipients = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, role: true },
  });
  await Promise.all(
    recipients.map((user) =>
      notifyUser({
        userId: user.id,
        schoolId: opts.schoolId,
        title: opts.subject,
        message: opts.body.slice(0, 180),
        type: "INFO",
        link: ROLE_MESSAGES[user.role],
      })
    )
  );

  return message;
}

export function messageInboxPath(role?: UserRole) {
  return role ? ROLE_MESSAGES[role] : "/admin/messages";
}

export function userCanAccessMessage(opts: {
  userId: string;
  senderId: string;
  recipientUserIds: string[];
}) {
  return opts.userId === opts.senderId || opts.recipientUserIds.includes(opts.userId);
}
