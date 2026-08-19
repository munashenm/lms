import { NextRequest, NextResponse } from "next/server";
import { StudentLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createStudentLedgerEntry } from "@/lib/student-ledger";
import { nextCreditNoteNumber } from "@/lib/finance-catalog";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const notes = await prisma.creditNote.findMany({
    where: getSchoolFilter(session!),
    include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ creditNotes: notes });
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
  const student = await prisma.student.findFirst({ where: { id: parsed.data.studentId, schoolId } });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });
  const number = await nextCreditNoteNumber(schoolId);
  const ledger = await createStudentLedgerEntry({
    schoolId,
    studentId: student.id,
    type: StudentLedgerType.CREDIT,
    description: `Credit note ${number}: ${parsed.data.reason}`,
    amount: parsed.data.amount,
    invoiceId: parsed.data.invoiceId,
    recordedById: session!.userId,
    reference: number,
  });
  const note = await prisma.creditNote.create({
    data: {
      schoolId,
      studentId: student.id,
      number,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      invoiceId: parsed.data.invoiceId ?? null,
      ledgerEntryId: ledger.id,
      createdById: session!.userId,
    },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "CreditNote",
    entityId: note.id,
    metadata: { number, amount: parsed.data.amount },
  });
  return NextResponse.json({ creditNote: note }, { status: 201 });
}
