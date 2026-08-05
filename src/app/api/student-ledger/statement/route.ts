import { NextRequest, NextResponse } from "next/server";
import { CommunicationCategory, UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { getChildStudentIds, getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { getStudentLedger, STUDENT_LEDGER_TYPE_LABELS } from "@/lib/student-ledger";
import { generateFeeStatementPdf } from "@/lib/pdf-fee-statement";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { formatDate } from "@/lib/utils";
import { sendLoggedEmail } from "@/lib/communications";
import { logAudit } from "@/lib/audit";

async function resolveStudentId(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  studentId: string | null
) {
  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    return student?.id ?? null;
  }
  if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (!studentId || !childIds.includes(studentId)) return null;
    return studentId;
  }
  if (!requirePermission(session, "finance:read")) return null;
  if (!studentId) return null;
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...getSchoolFilter(session) },
    select: { id: true },
  });
  return student?.id ?? null;
}

async function buildStatement(studentId: string, academicYearId?: string | null) {
  const studentRow = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!studentRow) return null;

  const [ledger, school, primaryGuardian] = await Promise.all([
    getStudentLedger({ studentId, academicYearId }),
    prisma.school.findUnique({ where: { id: studentRow.schoolId } }),
    prisma.studentGuardian.findFirst({
      where: { studentId, isPrimary: true },
      include: { guardian: true },
    }),
  ]);

  if (!ledger.student || !school) return null;

  const chronological = [...ledger.entries].reverse();
  const lines = chronological.map((e) => ({
    date: formatDate(e.entryDate),
    description: e.description,
    type: STUDENT_LEDGER_TYPE_LABELS[e.type],
    amount: e.signedAmount,
  }));

  const yearName =
    chronological.find((e) => e.academicYear?.name)?.academicYear?.name ?? null;

  const pdf = await generateFeeStatementPdf({
    brand: toSchoolBrand(school),
    studentName: `${ledger.student.firstName} ${ledger.student.lastName}`,
    studentNumber: ledger.student.studentNumber,
    gradeOrProgramme: [ledger.student.grade?.name, ledger.student.class?.name]
      .filter(Boolean)
      .join(" / "),
    academicYear: yearName,
    guardianName: primaryGuardian
      ? `${primaryGuardian.guardian.firstName} ${primaryGuardian.guardian.lastName}`
      : null,
    generatedAt: formatDate(new Date()),
    openingBalance: 0,
    balance: ledger.balance,
    lines,
  });

  return {
    pdf,
    school,
    student: ledger.student,
    balance: ledger.balance,
    guardian: primaryGuardian?.guardian ?? null,
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const studentId = await resolveStudentId(
    session,
    request.nextUrl.searchParams.get("studentId")
  );
  if (!studentId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const statement = await buildStatement(
    studentId,
    request.nextUrl.searchParams.get("academicYearId")
  );
  if (!statement) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const filename = `fee-statement-${statement.student.studentNumber}.pdf`;
  return new NextResponse(Buffer.from(statement.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const studentId = await resolveStudentId(session!, body.studentId ?? null);
  if (!studentId) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const statement = await buildStatement(studentId, body.academicYearId);
  if (!statement) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const toEmail = body.toEmail || statement.guardian?.email || statement.student.email;
  if (!toEmail) {
    return NextResponse.json(
      { message: "No guardian/student email on file" },
      { status: 400 }
    );
  }

  const recipientName = statement.guardian
    ? `${statement.guardian.firstName} ${statement.guardian.lastName}`
    : "Parent/Guardian";

  const subject = `School Fee Statement – ${statement.student.firstName} ${statement.student.lastName} – ${formatDate(new Date())}`;
  const message = `Dear ${recipientName},

Please find attached the latest school fee statement for ${statement.student.firstName} ${statement.student.lastName}.

Current outstanding balance: R${statement.balance.toFixed(2)}.

Please contact the accounts department should you require assistance regarding the account.

Kind regards,
${statement.school.name} Accounts Department`;

  const log = await sendLoggedEmail({
    schoolId: statement.school.id,
    studentId,
    category: CommunicationCategory.FEE_STATEMENT,
    recipientName,
    recipientContact: toEmail,
    subject,
    message,
    attachments: [
      {
        filename: `fee-statement-${statement.student.studentNumber}.pdf`,
        type: "application/pdf",
        contentBase64: Buffer.from(statement.pdf).toString("base64"),
      },
    ],
    metadata: { balance: statement.balance },
  });

  await logAudit({
    schoolId: statement.school.id,
    userId: session!.userId,
    action: "CREATE",
    entity: "FeeStatement",
    entityId: studentId,
    metadata: { channel: "email", to: toEmail, status: log.status },
  });

  return NextResponse.json({
    ok: true,
    status: log.status,
    message:
      log.status === "SENT"
        ? "Statement email sent"
        : log.error || "Statement logged (email provider not ready)",
  });
}
