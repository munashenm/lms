import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { roundMoney } from "@/lib/money";
import { paymentBelongsToStudent } from "@/lib/refund-payment";
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
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  let paymentId: string | null = parsed.data.paymentId ?? null;
  if (paymentId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, schoolId, reversedAt: null },
      include: { invoice: { select: { studentId: true, schoolId: true } } },
    });
    if (
      !paymentBelongsToStudent({
        payment,
        studentId: student.id,
        schoolId,
      })
    ) {
      return NextResponse.json(
        { message: "Payment does not belong to this student" },
        { status: 400 }
      );
    }
  }

  const refund = await prisma.refund.create({
    data: {
      schoolId,
      studentId: parsed.data.studentId,
      paymentId,
      amount: roundMoney(parsed.data.amount),
      reason: parsed.data.reason,
      status: ApprovalStatus.PENDING,
      createdById: session!.userId,
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Refund",
    entityId: refund.id,
    metadata: { amount: parsed.data.amount, status: "PENDING" },
  });
  return NextResponse.json({ refund }, { status: 201 });
}
