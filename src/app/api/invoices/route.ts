import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId, getStudentForSession, getChildStudentIds } from "@/lib/portal-data";
import { invoiceSchema } from "@/lib/validators";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyStudentGuardians } from "@/lib/notifications";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const studentId = searchParams.get("studentId");

  let studentFilter: { studentId?: string | { in: string[] } } = {};

  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    if (!student) return NextResponse.json({ invoices: [] });
    studentFilter = { studentId: student.id };
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (childIds.length === 0) return NextResponse.json({ invoices: [] });
    studentFilter = { studentId: { in: childIds } };
  } else if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      ...getSchoolFilter(session),
      ...studentFilter,
      ...(status && { status: status as "SENT" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" }),
      ...(studentId && { studentId }),
      ...(session.role === UserRole.STUDENT || session.role === UserRole.PARENT
        ? { status: { not: "DRAFT" } }
        : {}),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      lineItems: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session!);
  const data = parsed.data;
  const { subtotal, total } = calculateInvoiceTotals(
    data.lineItems.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
    data.discount
  );

  const invoiceNumber = await generateInvoiceNumber(schoolId, () =>
    prisma.invoice.count({ where: { schoolId } })
  );

  const invoice = await prisma.invoice.create({
    data: {
      schoolId,
      studentId: data.studentId,
      invoiceNumber,
      description: data.description || null,
      subtotal,
      discount: data.discount,
      total,
      status: data.status,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      lineItems: {
        create: data.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
        })),
      },
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      lineItems: true,
    },
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNumber, total },
  });

  if (data.status === "SENT") {
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { userId: true },
    });
    if (student?.userId) {
      await notifyUser({
        userId: student.userId,
        schoolId,
        title: "New invoice",
        message: `Invoice ${invoiceNumber} for R${total.toFixed(2)} has been issued.`,
        type: "FEE",
        link: `/student/fees/${invoice.id}`,
      });
    }
    await notifyStudentGuardians({
      studentId: data.studentId,
      schoolId,
      title: "New school fee invoice",
      message: `Invoice ${invoiceNumber} for R${total.toFixed(2)} is now available.`,
      type: "FEE",
      link: `/parent/fees/${invoice.id}`,
    });
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
