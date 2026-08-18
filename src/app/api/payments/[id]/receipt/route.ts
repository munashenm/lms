import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getChildStudentIds, getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import {
  emailPaymentReceipt,
  loadPaymentReceiptDocument,
} from "@/lib/payment-receipt-document";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function canAccessInvoice(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  studentId: string,
  schoolId: string
) {
  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    return student?.id === studentId;
  }
  if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    return childIds.includes(studentId);
  }
  if (requirePermission(session, "finance:read")) {
    const filter = getSchoolFilter(session);
    return !("schoolId" in filter) || filter.schoolId === schoolId;
  }
  return false;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await loadPaymentReceiptDocument(id);
  if (!doc) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const allowed = await canAccessInvoice(
    session,
    doc.invoice.studentId,
    doc.invoice.schoolId
  );
  if (!allowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  return new NextResponse(Buffer.from(doc.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.filename}"`,
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { id: true, invoice: { select: { schoolId: true } } },
  });
  if (!payment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const filter = getSchoolFilter(session!);
  if (
    "schoolId" in filter &&
    filter.schoolId !== payment.invoice.schoolId
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await emailPaymentReceipt({
    paymentId: id,
    userId: session!.userId,
    toEmail: typeof body.toEmail === "string" ? body.toEmail : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
