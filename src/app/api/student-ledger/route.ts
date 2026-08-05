import { NextRequest, NextResponse } from "next/server";
import { StudentLedgerType, UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId, getStudentForSession, getChildStudentIds } from "@/lib/portal-data";
import { studentLedgerEntrySchema } from "@/lib/validators";
import {
  createStudentLedgerEntry,
  getStudentLedger,
  signedAmountForType,
} from "@/lib/student-ledger";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId");
  const academicYearId = request.nextUrl.searchParams.get("academicYearId");

  let resolvedStudentId = studentId;

  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    resolvedStudentId = student?.id ?? null;
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (!studentId || !childIds.includes(studentId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  } else if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  if (!resolvedStudentId) {
    return NextResponse.json({ message: "studentId required" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: resolvedStudentId, ...getSchoolFilter(session) },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const ledger = await getStudentLedger({
    studentId: resolvedStudentId,
    academicYearId,
  });

  return NextResponse.json(ledger);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = studentLedgerEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const schoolId = await requireSchoolId(session!);
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
  });
  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const type = parsed.data.type as StudentLedgerType;
  const entry = await createStudentLedgerEntry({
    schoolId,
    studentId: student.id,
    academicYearId: parsed.data.academicYearId,
    type,
    description: parsed.data.description,
    amount: parsed.data.amount,
    signedAmount: signedAmountForType(type, parsed.data.amount),
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    entryDate: parsed.data.entryDate ? new Date(parsed.data.entryDate) : new Date(),
    recordedById: session!.userId,
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "StudentLedgerEntry",
    entityId: entry.id,
    metadata: { type, amount: parsed.data.amount, studentId: student.id },
  });

  return NextResponse.json({
    entry: { ...entry, signedAmount: Number(entry.signedAmount) },
  }, { status: 201 });
}
