import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { marksBulkSchema } from "@/lib/validators";
import { percentageToSymbol } from "@/lib/grading";
import { logAudit } from "@/lib/audit";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { assessmentSchoolId, assertStudentsInSchool, scopedId } from "@/lib/tenant";
import { tenantMiss } from "@/lib/authorize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id: assessmentId } = await params;
  const body = await request.json();
  const parsed = marksBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const assessmentRow = await prisma.assessment.findFirst({
    where: scopedId(session!, assessmentId),
    include: {
      subject: { select: { schoolId: true } },
      module: { include: { course: { select: { schoolId: true } } } },
      teacher: { select: { schoolId: true } },
    },
  });
  const schoolId = assessmentRow ? assessmentSchoolId(assessmentRow) : null;
  if (!assessmentRow || !schoolId) {
    return tenantMiss();
  }

  const studentIds = parsed.data.marks.map((m) => m.studentId);
  if (!(await assertStudentsInSchool(studentIds, schoolId))) {
    return tenantMiss();
  }

  const denied = await requireLicenseWrite(schoolId, { feature: "assessments" });
  if (denied) return denied;

  const maxMarks = Number(assessmentRow.maxMarks);
  const results = await Promise.all(
    parsed.data.marks.map((m) => {
      const pct = (m.score / maxMarks) * 100;
      const gradeSymbol = percentageToSymbol(pct);
      return prisma.mark.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: m.studentId },
        },
        create: {
          assessmentId,
          studentId: m.studentId,
          score: m.score,
          gradeSymbol,
          comments: m.comments ?? null,
        },
        update: {
          score: m.score,
          gradeSymbol,
          comments: m.comments ?? null,
          recordedAt: new Date(),
        },
      });
    })
  );

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "BULK_UPDATE",
    entity: "Mark",
    entityId: assessmentId,
    metadata: { count: results.length },
  });

  return NextResponse.json({ saved: results.length });
}
