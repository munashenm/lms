import { NextRequest, NextResponse } from "next/server";
import { StudentAidType, StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { logAudit } from "@/lib/audit";
import { getDocumentRelease } from "@/lib/fee-clearance";
import { notifyDocumentsReleasedIfClear } from "@/lib/academic-document-notice";
import { z } from "zod";

const schema = z.object({
  studentId: z.string().min(1),
  type: z.nativeEnum(StudentAidType),
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  academicYearId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const LEDGER: Record<StudentAidType, StudentLedgerType> = {
  DISCOUNT: StudentLedgerType.DISCOUNT,
  BURSARY: StudentLedgerType.BURSARY,
  SCHOLARSHIP: StudentLedgerType.SPONSORSHIP,
  SPONSORSHIP: StudentLedgerType.SPONSORSHIP,
};

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const awards = await prisma.studentAidAward.findMany({
    where: getSchoolFilter(session!),
    include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ awards });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.payments.create") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
    select: { id: true, userId: true },
  });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });
  const previous = await getDocumentRelease(student.id);
  const ledger = await createStudentLedgerEntry({
    schoolId,
    studentId: student.id,
    academicYearId: parsed.data.academicYearId,
    type: LEDGER[parsed.data.type],
    description: parsed.data.name,
    amount: parsed.data.amount,
    recordedById: session!.userId,
    notes: parsed.data.notes,
  });
  const award = await prisma.studentAidAward.create({
    data: {
      schoolId,
      studentId: student.id,
      academicYearId: parsed.data.academicYearId ?? null,
      type: parsed.data.type,
      name: parsed.data.name,
      amount: parsed.data.amount,
      ledgerEntryId: ledger.id,
      notes: parsed.data.notes ?? null,
      createdById: session!.userId,
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "StudentAidAward",
    entityId: award.id,
    metadata: { type: award.type, amount: parsed.data.amount },
  });
  await notifyDocumentsReleasedIfClear({
    studentId: student.id,
    schoolId,
    studentUserId: student.userId,
    previous,
  });
  return NextResponse.json({ award }, { status: 201 });
}
