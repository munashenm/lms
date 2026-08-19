import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  studentId: z.string().min(1),
  paymentId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const refunds = await prisma.refund.findMany({
    where: getSchoolFilter(session!),
    include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ refunds });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.payments.reverse") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const ledger = await createStudentLedgerEntry({
    schoolId,
    studentId: parsed.data.studentId,
    type: StudentLedgerType.REFUND,
    description: parsed.data.reason,
    amount: parsed.data.amount,
    paymentId: parsed.data.paymentId,
    recordedById: session!.userId,
  });
  const refund = await prisma.refund.create({
    data: {
      schoolId,
      studentId: parsed.data.studentId,
      paymentId: parsed.data.paymentId ?? null,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      status: ApprovalStatus.POSTED,
      ledgerEntryId: ledger.id,
      createdById: session!.userId,
      processedAt: new Date(),
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Refund",
    entityId: refund.id,
    metadata: { amount: parsed.data.amount },
  });
  return NextResponse.json({ refund }, { status: 201 });
}
