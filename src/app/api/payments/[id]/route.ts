import { NextRequest, NextResponse } from "next/server";
import { PaymentCaptureStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireStaffPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { scopedId } from "@/lib/tenant";
import { saveFinanceSlip } from "@/lib/finance-uploads";
import { postApprovedPayment } from "@/lib/manual-payment";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  action: z.enum(["verify", "approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !requireStaffPermission(session, "finance.payments.approve")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const payment = await prisma.payment.findFirst({ where: scopedId(session, id) });
  if (!payment) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 0) {
      const proofUrl = await saveFinanceSlip(payment.schoolId, "payments", proof);
      const updated = await prisma.payment.update({ where: { id }, data: { proofUrl } });
      return NextResponse.json({ payment: updated });
    }
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  if (payment.reversalOfId || payment.reversedAt) {
    return NextResponse.json({ message: "This payment cannot be updated" }, { status: 400 });
  }

  if (parsed.data.action === "verify") {
    if (payment.captureStatus !== PaymentCaptureStatus.PENDING) {
      return NextResponse.json({ message: "Only pending payments can be verified" }, { status: 400 });
    }
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        captureStatus: PaymentCaptureStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: session.userId,
      },
    });
    await logAudit({
      schoolId: payment.schoolId,
      userId: session.userId,
      action: "PAYMENT_VERIFIED",
      entity: "Payment",
      entityId: id,
    });
    return NextResponse.json({ payment: updated });
  }

  if (parsed.data.action === "reject") {
    if (
      payment.captureStatus !== PaymentCaptureStatus.PENDING &&
      payment.captureStatus !== PaymentCaptureStatus.VERIFIED
    ) {
      return NextResponse.json({ message: "Only pending or verified payments can be rejected" }, { status: 400 });
    }
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        captureStatus: PaymentCaptureStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedById: session.userId,
        rejectReason: parsed.data.reason || "Rejected",
      },
    });
    await logAudit({
      schoolId: payment.schoolId,
      userId: session.userId,
      action: "PAYMENT_REJECTED",
      entity: "Payment",
      entityId: id,
      metadata: { reason: parsed.data.reason },
    });
    return NextResponse.json({ payment: updated });
  }

  if (
    payment.captureStatus !== PaymentCaptureStatus.PENDING &&
    payment.captureStatus !== PaymentCaptureStatus.VERIFIED
  ) {
    return NextResponse.json({ message: "Only pending or verified payments can be approved" }, { status: 400 });
  }

  const posted = await postApprovedPayment({ paymentId: id, userId: session.userId });
  return NextResponse.json({ payment: posted });
}
