import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedLearner } from "@/lib/learner-scope";
import { studentAbsenceSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createLearnerAbsenceRequest } from "@/lib/student-absence";

export async function GET() {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const requests = await prisma.studentAbsenceRequest.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const denied = await requireLicenseWrite(student.schoolId, { feature: "student_leave" });
  if (denied) return denied;

  const school = await prisma.school.findUnique({
    where: { id: student.schoolId },
    select: { studentLeaveRequiresGuardian: true },
  });
  if (school?.studentLeaveRequiresGuardian) {
    return NextResponse.json(
      { message: "This institution requires a parent or guardian to submit leave requests." },
      { status: 403 }
    );
  }

  const parsed = studentAbsenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const result = await createLearnerAbsenceRequest({
    schoolId: student.schoolId,
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      classId: student.classId,
      userId: student.userId,
    },
    type: parsed.data.type,
    fromDate: new Date(parsed.data.fromDate),
    toDate: new Date(parsed.data.toDate),
    reason: parsed.data.reason,
    documentUrl: parsed.data.documentUrl,
    source: "STUDENT",
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}
