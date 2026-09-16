import { NextRequest, NextResponse } from "next/server";
import { PromotionEligibility, PromotionOutcome } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { requireSchoolId } from "@/lib/portal-data";
import { commitPromotion, evaluateStudentPromotion } from "@/lib/promotion";
import { promotionCommitSchema } from "@/lib/validators";
import { emptyToNull } from "@/lib/class-teachers";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "students.promote");
  if (denied) return denied;

  const schoolId = await requireSchoolId(session!);
  const yearId = request.nextUrl.searchParams.get("academicYearId");
  const gradeId = request.nextUrl.searchParams.get("gradeId");
  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!yearId) return NextResponse.json({ message: "academicYearId is required" }, { status: 400 });

  const students = studentId
    ? await prisma.student.findMany({ where: { id: studentId, schoolId } })
    : await prisma.student.findMany({
        where: {
          schoolId,
          status: { in: ["ACTIVE", "SUSPENDED"] },
          ...(gradeId ? { gradeId } : {}),
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

  const rows = [];
  for (const student of students) {
    const check = await evaluateStudentPromotion({
      schoolId,
      studentId: student.id,
      academicYearId: yearId,
    });
    if (check) rows.push(check);
  }

  return NextResponse.json({
    summary: {
      total: rows.length,
      eligible: rows.filter((row) => row.eligibility === PromotionEligibility.ELIGIBLE).length,
      notEligible: rows.filter((row) => row.eligibility === PromotionEligibility.NOT_ELIGIBLE).length,
      review: rows.filter((row) => row.eligibility === PromotionEligibility.REVIEW_REQUIRED).length,
    },
    students: rows,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const parsed = promotionCommitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: parsed.data.studentId } });
  if (!student || !canAccessSchool(session!, student.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const check = await evaluateStudentPromotion({
    schoolId: student.schoolId,
    studentId: student.id,
    academicYearId: parsed.data.fromAcademicYearId,
  });
  if (!check) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const needsOverride =
    parsed.data.override ||
    (check.eligibility !== PromotionEligibility.ELIGIBLE &&
      parsed.data.outcome !== PromotionOutcome.REPEATED &&
      parsed.data.outcome !== PromotionOutcome.WITHDRAWN &&
      parsed.data.outcome !== PromotionOutcome.DEFERRED);

  const permission = needsOverride ? "students.promotion_override" : "students.promote";
  const denied = await denyUnless(session, permission, student.schoolId);
  if (denied) return denied;

  if (needsOverride && !parsed.data.overrideReason?.trim()) {
    return NextResponse.json({ message: "Override reason is required" }, { status: 400 });
  }

  const decision = await commitPromotion({
    schoolId: student.schoolId,
    studentId: student.id,
    fromAcademicYearId: parsed.data.fromAcademicYearId,
    toAcademicYearId: emptyToNull(parsed.data.toAcademicYearId),
    toGradeId: emptyToNull(parsed.data.toGradeId),
    toClassId: emptyToNull(parsed.data.toClassId),
    outcome: parsed.data.outcome,
    overridden: needsOverride,
    overrideReason: parsed.data.overrideReason,
    notes: parsed.data.notes,
    actorId: session!.userId,
    check,
  });

  return NextResponse.json({ decision });
}
