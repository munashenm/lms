import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireStaffPermission } from "@/lib/rbac";
import { refundPatchSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { logAudit } from "@/lib/audit";
import { nextRefundStatus } from "@/lib/refund-approval";
import { roundMoney } from "@/lib/money";
import { scopedId } from "@/lib/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !requireStaffPermission(session, "finance.payments.create") &&
    !requireStaffPermission(session, "finance:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.refund.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "finance" });
  if (denied) return denied;

  const parsed = refundPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const next = nextRefundStatus(existing.status, parsed.data.action);
  if (!next && existing.status !== ApprovalStatus.POSTED) {
    return NextResponse.json(
      { message: "Only pending refunds can be approved or rejected" },
      { status: 400 }
    );
  }

  if (parsed.data.action === "reject") {
    if (existing.status !== ApprovalStatus.PENDING) {
      return NextResponse.json({ message: "Only pending refunds can be approved or rejected" }, { status: 400 });
    }
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

  let refund;
  try {
    refund = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: ApprovalStatus; ledgerEntryId: string | null }>>`
      SELECT id, status, "ledgerEntryId" FROM "refunds" WHERE id = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new Error("Not found");
    if (row.status === ApprovalStatus.POSTED || row.ledgerEntryId) {
      return tx.refund.findUniqueOrThrow({ where: { id } });
    }
    if (row.status !== ApprovalStatus.PENDING) {
      throw new Error("Only pending refunds can be approved or rejected");
    }
    const ledger = await createStudentLedgerEntry({
      schoolId: existing.schoolId,
      studentId: existing.studentId,
      type: StudentLedgerType.REFUND,
      description: existing.reason,
      amount: roundMoney(Number(existing.amount)),
      paymentId: existing.paymentId,
      recordedById: session.userId,
      db: tx as unknown as import("@prisma/client").Prisma.TransactionClient,
    });
    return tx.refund.update({
      where: { id },
      data: {
        status: ApprovalStatus.POSTED,
        ledgerEntryId: ledger.id,
        processedAt: new Date(),
      },
    });
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve refund";
    return NextResponse.json({ message }, { status: 400 });
  }

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
