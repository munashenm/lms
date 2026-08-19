import { NextRequest, NextResponse } from "next/server";
import { CommunicationCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { noticeComposeSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { createNoticeBatch } from "@/lib/notice-comms";
import { processCommunicationBatch } from "@/lib/bulk-fee-comms";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (
    !session ||
    (!hasPermission(session.role, "settings:read") && !hasPermission(session.role, "finance:read"))
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as CommunicationCategory | null;
  const studentId = searchParams.get("studentId");

  const logs = await prisma.communicationLog.findMany({
    where: {
      ...getSchoolFilter(session),
      ...(category ? { category } : {}),
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ logs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasPermission(session.role, "announcements:write") &&
    !hasPermission(session.role, "settings:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = noticeComposeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.audience === "STUDENT" && !parsed.data.studentId) {
    return NextResponse.json({ message: "Select a student" }, { status: 400 });
  }
  if (parsed.data.audience === "CLASS" && !parsed.data.classId) {
    return NextResponse.json({ message: "Select a class" }, { status: 400 });
  }
  if (parsed.data.audience === "GRADE" && !parsed.data.gradeId) {
    return NextResponse.json({ message: "Select a grade" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;

  const batch = await createNoticeBatch({
    schoolId,
    audience: parsed.data.audience,
    channel: parsed.data.channel,
    category: parsed.data.category as CommunicationCategory,
    subject: parsed.data.subject,
    message: parsed.data.message,
    studentId: parsed.data.studentId,
    classId: parsed.data.classId,
    gradeId: parsed.data.gradeId,
    createdById: session.userId,
  });

  let processResult: Awaited<ReturnType<typeof processCommunicationBatch>> | null = null;
  if (parsed.data.processImmediately !== false && batch.queuedCount > 0) {
    let remaining = batch.queuedCount;
    let rounds = 0;
    while (remaining > 0 && rounds < 8) {
      processResult = await processCommunicationBatch(batch.id, 50);
      remaining = processResult.remaining;
      rounds += 1;
    }
  }

  await logAudit({
    schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "CommunicationBatch",
    entityId: batch.id,
    metadata: { audience: parsed.data.audience, channel: parsed.data.channel, category: parsed.data.category },
  });

  return NextResponse.json({ batch: processResult?.batch ?? batch, processResult }, { status: 201 });
}
