import { NextRequest, NextResponse } from "next/server";
import { IssuedLetterType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessAdmin, getSchoolFilter, hasPermission } from "@/lib/rbac";
import { issuedLetterSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { defaultLetterBody, generateLetterPdf } from "@/lib/pdf-letter";
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";
import { generateTranscriptPdf } from "@/lib/pdf-transcript";
import { calculatePercentage, calculateWeightedAverage, percentageToSymbol } from "@/lib/grading";
import { getTerminology } from "@/lib/terminology";
import { formatDate } from "@/lib/utils";
import { authorizeAcademicDocument, isLearnerPortalRole } from "@/lib/fee-clearance";
import { getStudentForSession, getChildStudentIds } from "@/lib/portal-data";
import { writeAcademicPdf } from "@/lib/pdf-response";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId");
  const staff = !isLearnerPortalRole(session.role);

  let filterIds: string[] | null = null;
  if (staff) {
    filterIds = studentId ? [studentId] : null;
  } else if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    filterIds = [student.id];
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;
  } else {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const letters = await prisma.issuedLetter.findMany({
    where: {
      ...(filterIds ? { studentId: { in: filterIds.length ? filterIds : ["__none__"] } } : {}),
      student: getSchoolFilter(session),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  const visible = [];
  for (const letter of letters) {
    const access = await authorizeAcademicDocument({
      session,
      studentId: letter.studentId,
      schoolId: letter.schoolId,
    });
    if (!access.ok) continue;
    const { pdfUrl: _pdfUrl, ...rest } = letter;
    visible.push(rest);
  }

  return NextResponse.json({ letters: visible });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !canAccessAdmin(session.role) &&
    !hasPermission(session.role, "marks:write") &&
    !hasPermission(session.role, "finance:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = issuedLetterSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, ...getSchoolFilter(session!) },
    include: {
      school: true,
      grade: true,
      class: true,
      marks: { include: { assessment: { include: { subject: true } } } },
    },
  });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  const denied = await requireLicenseWrite(student.schoolId, { feature: "assessments" });
  if (denied) return denied;

  const type = parsed.data.type as IssuedLetterType;
  const title = parsed.data.title || ISSUED_LETTER_LABELS[type] || "Official letter";
  const effectiveDate = parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : new Date();
  const issuedAt = new Date();
  const count = await prisma.issuedLetter.count({ where: { schoolId: student.schoolId } });
  const letterNo = `LTR-${issuedAt.getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const terms = getTerminology(student.school.institutionType);
  const brand = toSchoolBrand(student.school);
  const studentName = `${student.firstName} ${student.lastName}`;

  let pdfBytes: Uint8Array;
  if (type === IssuedLetterType.TRANSCRIPT) {
    const subjectMarks = new Map<string, { name: string; score: number; maxMarks: number }>();
    for (const mark of student.marks) {
      const name = mark.assessment.subject?.name ?? mark.assessment.title;
      const existing = subjectMarks.get(name);
      const score = Number(mark.score);
      const max = Number(mark.assessment.maxMarks);
      if (existing) {
        existing.score += score;
        existing.maxMarks += max;
      } else {
        subjectMarks.set(name, { name, score, maxMarks: max });
      }
    }
    const subjects = Array.from(subjectMarks.values()).map((row) => {
      const percentage = calculatePercentage(row.score, row.maxMarks);
      return { ...row, percentage, symbol: percentageToSymbol(percentage) };
    });
    const overallAverage = calculateWeightedAverage(
      student.marks.map((m) => ({
        score: Number(m.score),
        maxMarks: Number(m.assessment.maxMarks),
        weight: m.assessment.weight ? Number(m.assessment.weight) : 1,
      }))
    );
    pdfBytes = await generateTranscriptPdf({
      brand,
      studentName,
      studentNumber: student.studentNumber,
      studentNumberLabel: terms.admissionNumber,
      grade: student.grade?.name ?? "—",
      className: student.class?.name ?? "—",
      academicYear: "Current record",
      letterNo,
      issuedAt: formatDate(issuedAt),
      subjects,
      overallAverage,
      overallSymbol: percentageToSymbol(overallAverage),
    });
  } else {
    const body =
      parsed.data.bodyText?.trim() ||
      defaultLetterBody({
        type,
        schoolName: student.school.name,
        studentName,
        studentNumber: student.studentNumber,
        grade: student.grade?.name ?? undefined,
        destinationSchool: parsed.data.destinationSchool,
        reason: parsed.data.reason,
      });
    pdfBytes = await generateLetterPdf({
      brand,
      title,
      letterNo,
      studentName,
      studentNumber: student.studentNumber,
      studentNumberLabel: terms.admissionNumber,
      grade: student.grade?.name ?? undefined,
      body,
      issuedAt: formatDate(issuedAt),
      effectiveDate: formatDate(effectiveDate),
      destinationSchool: parsed.data.destinationSchool,
    });
  }

  const filename = `${letterNo.toLowerCase()}.pdf`;
  const pdfUrl = await writeAcademicPdf("letters", filename, pdfBytes);

  const letter = await prisma.issuedLetter.create({
    data: {
      schoolId: student.schoolId,
      studentId: student.id,
      type,
      letterNo,
      title,
      destinationSchool: parsed.data.destinationSchool || null,
      reason: parsed.data.reason || null,
      bodyText: parsed.data.bodyText || null,
      effectiveDate,
      pdfUrl,
      issuedAt,
      issuedById: session!.userId,
    },
    include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
  });

  await logAudit({
    schoolId: student.schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "IssuedLetter",
    entityId: letter.id,
    metadata: { type, letterNo, studentId: student.id },
  });

  return NextResponse.json({ letter }, { status: 201 });
}
