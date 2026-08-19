import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, hasPermission } from "@/lib/rbac";
import { refundPatchSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { logAudit } from "@/lib/audit";
import { nextRefundStatus } from "@/lib/refund-approval";
import { roundMoney } from "@/lib/money";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasPermission(session.role, "finance.payments.reverse") &&
    !hasPermission(session.role, "finance:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.refund.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "finance" });
  if (denied) return denied;

  const parsed = refundPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const next = nextRefundStatus(existing.status, parsed.data.action);
  if (!next) {
    return NextResponse.json(
      { message: "Only pending refunds can be approved or rejected" },
      { status: 400 }
    );
  }

  if (next === ApprovalStatus.REJECTED) {
    const refund = await prisma.refund.update({
      where: { id },
      data: { status: ApprovalStatus.REJECTED, processedAt: new Date() },
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Refund",
      entityId: id,
      metadata: { status: "REJECTED" },
    });
    return NextResponse.json({ refund });
  }

  if (existing.ledgerEntryId) {
    const refund = await prisma.refund.update({
      where: { id },
      data: { status: ApprovalStatus.POSTED, processedAt: existing.processedAt ?? new Date() },
    });
    return NextResponse.json({ refund });
  }

  const ledger = await createStudentLedgerEntry({
    schoolId: existing.schoolId,
    studentId: existing.studentId,
    type: StudentLedgerType.REFUND,
    description: existing.reason,
    amount: roundMoney(Number(existing.amount)),
    paymentId: existing.paymentId,
    recordedById: session.userId,
  });

  const refund = await prisma.refund.update({
    where: { id },
    data: {
      status: ApprovalStatus.POSTED,
      ledgerEntryId: ledger.id,
      processedAt: new Date(),
    },
  });

  await logAudit({
    schoolId: existing.schoolId,
    userId: session.userId,
    action: "UPDATE",
    entity: "Refund",
    entityId: id,
    metadata: { status: "POSTED" },
  });

  return NextResponse.json({ refund });
}
