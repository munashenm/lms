import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireStaffPermission, getSchoolFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  processCommunicationBatch,
  retryFailedBatchMessages,
} from "@/lib/bulk-fee-comms";
import { logAudit } from "@/lib/audit";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requireStaffPermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const batch = await prisma.communicationBatch.findFirst({
    where: { id, ...getSchoolFilter(session!) },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentNumber: true },
          },
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/finance/bulk-reminders",
      method: "POST",
      feature: "finance",
    });
    if (__licDenied) return __licDenied;
  }
if (!requireStaffPermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const batch = await prisma.communicationBatch.findFirst({
    where: { id, ...getSchoolFilter(session!) },
  });
  if (!batch) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "retry_failed") {
    const updated = await retryFailedBatchMessages(id);
    const result = await processCommunicationBatch(id, 15);
    await logAudit({
      schoolId: batch.schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "CommunicationBatch",
      entityId: id,
      metadata: { action: "retry_failed" },
    });
    return NextResponse.json({ batch: result.batch ?? updated, processResult: result });
  }

  const result = await processCommunicationBatch(id, body.limit ?? 15);
  await logAudit({
    schoolId: batch.schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "CommunicationBatch",
    entityId: id,
    metadata: { action: "process", processed: result.processed },
  });

  return NextResponse.json({ batch: result.batch, processResult: result });
}
