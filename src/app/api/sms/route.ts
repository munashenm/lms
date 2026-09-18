import { NextRequest, NextResponse } from "next/server";
import { CommunicationCategory, CommunicationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requireStaffPermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { sendLoggedSms } from "@/lib/communications";
import { resolveNoticeRecipients, type NoticeAudience } from "@/lib/notice-comms";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  to: z.string().min(8).optional(),
  message: z.string().min(1).max(1600),
  recipientName: z.string().optional(),
  studentId: z.string().optional(),
  audience: z.enum(["STUDENT", "CLASS", "GRADE", "PARENTS", "STUDENTS", "STAFF"]).optional(),
  classId: z.string().optional(),
  gradeId: z.string().optional(),
  category: z.nativeEnum(CommunicationCategory).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requireStaffPermission(session, "sms.view") && !requireStaffPermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const logs = await prisma.communicationLog.findMany({
    where: { ...getSchoolFilter(session!), channel: CommunicationChannel.SMS },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ logs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireStaffPermission(session, "sms.send")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const audience = parsed.data.audience;
  if (audience) {
    const recipients = await resolveNoticeRecipients({
      schoolId,
      audience: audience as NoticeAudience,
      studentId: parsed.data.studentId,
      classId: parsed.data.classId,
      gradeId: parsed.data.gradeId,
    });
    const withPhone = recipients.filter((row) => row.phone);
    if (withPhone.length === 0) {
      return NextResponse.json({ message: "No mobile numbers found for that audience" }, { status: 400 });
    }
    const logs = [];
    for (const recipient of withPhone) {
      logs.push(
        await sendLoggedSms({
          schoolId,
          studentId: recipient.studentId,
          category: parsed.data.category ?? CommunicationCategory.GENERAL,
          recipientName: recipient.name,
          recipientContact: recipient.phone!,
          message: parsed.data.message,
        })
      );
    }
    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "SMS_BULK_SENT",
      entity: "CommunicationLog",
      entityId: logs[0]?.id,
      metadata: { audience, count: logs.length },
    });
    return NextResponse.json({ logs, count: logs.length }, { status: 201 });
  }

  if (!parsed.data.to) {
    return NextResponse.json({ message: "A mobile number or audience is required" }, { status: 400 });
  }

  const log = await sendLoggedSms({
    schoolId,
    studentId: parsed.data.studentId,
    category: parsed.data.category ?? CommunicationCategory.GENERAL,
    recipientName: parsed.data.recipientName,
    recipientContact: parsed.data.to,
    message: parsed.data.message,
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "SMS_SENT",
    entity: "CommunicationLog",
    entityId: log.id,
    metadata: { to: parsed.data.to, status: log.status },
  });
  return NextResponse.json({ log }, { status: log.status === "FAILED" ? 400 : 201 });
}
