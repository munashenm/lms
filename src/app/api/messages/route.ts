import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { resolveMessageUserIds, sendInternalMessage, unreadMessageCount } from "@/lib/internal-messages";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const box = request.nextUrl.searchParams.get("box") ?? "inbox";
  const unread = await unreadMessageCount(session.userId);

  if (box === "sent") {
    const messages = await prisma.internalMessage.findMany({
      where: { senderId: session.userId },
      include: {
        recipients: { include: { user: { select: { firstName: true, lastName: true, role: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return NextResponse.json({ messages, unread });
  }

  const receipts = await prisma.messageRecipient.findMany({
    where: {
      userId: session.userId,
      archivedAt: box === "archive" ? { not: null } : null,
    },
    include: {
      message: {
        include: {
          sender: { select: { firstName: true, lastName: true, role: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return NextResponse.json({
    unread,
    messages: receipts.map((row) => ({
      ...row.message,
      readAt: row.readAt,
      archivedAt: row.archivedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.send")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId, { feature: "messaging" });
  if (denied) return denied;

  const form = await request.formData();
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const audience = String(form.get("audience") ?? "USERS") as "USERS" | "CLASS" | "GRADE" | "STAFF" | "DEPARTMENT";
  const threadId = String(form.get("threadId") ?? "") || null;
  const classId = String(form.get("classId") ?? "") || null;
  const gradeId = String(form.get("gradeId") ?? "") || null;
  const department = String(form.get("department") ?? "") || null;
  const userIds = [
    ...form.getAll("userIds").map((value) => String(value)),
    String(form.get("userIds") ?? ""),
  ]
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);
  const attachment = form.get("attachment");

  if (!subject || !body) {
    return NextResponse.json({ message: "Subject and message are required" }, { status: 400 });
  }

  const isBulk = audience !== "USERS" || userIds.length > 1;
  if (isBulk && !requirePermission(session, "messaging.bulk_send")) {
    return NextResponse.json({ message: "Bulk messaging is not allowed for this account" }, { status: 403 });
  }

  const recipientUserIds = await resolveMessageUserIds({
    schoolId,
    senderRole: session.role,
    userIds,
    classId,
    gradeId,
    department,
    audience,
  });

  try {
    const message = await sendInternalMessage({
      schoolId,
      senderId: session.userId,
      subject,
      body,
      recipientUserIds,
      threadId,
      attachment: attachment instanceof File ? attachment : null,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Could not send message" },
      { status: 400 }
    );
  }
}
