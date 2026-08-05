import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { logAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, ...getSchoolFilter(session!) },
    include: {
      school: true,
      grade: { select: { name: true } },
      class: { select: { name: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const currentYear = await prisma.academicYear.findFirst({
    where: {
      schoolId: student.schoolId,
      OR: [{ isCurrent: true }, { status: "ACTIVE" }],
    },
    orderBy: { startDate: "desc" },
    select: { name: true },
  });

  const pdf = await generateStudentCardPdf({
    brand: toSchoolBrand(student.school),
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    gradeOrProgramme: student.grade?.name ?? null,
    className: student.class?.name ?? null,
    status: student.status,
    photoUrl: student.photoUrl,
    validYear: currentYear?.name ?? String(new Date().getFullYear()),
  });

  await logAudit({
    schoolId: student.schoolId,
    userId: session!.userId,
    action: "READ",
    entity: "StudentCard",
    entityId: student.id,
    metadata: { studentNumber: student.studentNumber },
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="student-card-${student.studentNumber}.pdf"`,
    },
  });
}
