import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import {
  createFeeCommsBatch,
  FEE_COMMS_CATEGORIES,
  listOutstandingFeeStudents,
  processCommunicationBatch,
} from "@/lib/bulk-fee-comms";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  action: z.enum(["FEE_REMINDER", "FEE_STATEMENT", "FEE_INVOICE"]),
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
  gradeId: z.string().optional().nullable(),
  minBalance: z.coerce.number().min(0).optional(),
  studentIds: z.array(z.string()).optional(),
  processImmediately: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN &&
    request.nextUrl.searchParams.get("schoolId")
      ? request.nextUrl.searchParams.get("schoolId")!
      : await requireSchoolId(session!);

  const gradeId = request.nextUrl.searchParams.get("gradeId");
  const minBalance = parseFloat(
    request.nextUrl.searchParams.get("minBalance") ?? "0.01"
  );

  const [students, batches, grades] = await Promise.all([
    listOutstandingFeeStudents({
      schoolId,
      gradeId,
      minBalance: Number.isFinite(minBalance) ? minBalance : 0.01,
    }),
    prisma.communicationBatch.findMany({
      where: {
        schoolId,
        category: { in: [...FEE_COMMS_CATEGORIES] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.grade.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({
    students,
    totalOutstanding: students.reduce((s, row) => s + row.outstanding, 0),
    batches,
    grades,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);

  const batch = await createFeeCommsBatch({
    schoolId,
    action: parsed.data.action,
    channel: parsed.data.channel,
    gradeId: parsed.data.gradeId,
    minBalance: parsed.data.minBalance,
    studentIds: parsed.data.studentIds,
    createdById: session!.userId,
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "CommunicationBatch",
    entityId: batch.id,
    metadata: {
      action: parsed.data.action,
      channel: parsed.data.channel,
      totalCount: batch.totalCount,
    },
  });

  let processResult = null;
  if (parsed.data.processImmediately !== false && batch.queuedCount > 0) {
    processResult = await processCommunicationBatch(batch.id, 15);
  }

  return NextResponse.json(
    {
      batch: processResult?.batch ?? batch,
      processResult,
    },
    { status: 201 }
  );
}
