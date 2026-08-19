import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getChildStudentIds } from "@/lib/portal-data";
import { linkedStudentIdsOrForbidden } from "@/lib/parent-scope";
import { parentStudentAbsenceSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { createLearnerAbsenceRequest } from "@/lib/student-absence";
import { parseAbsenceFields, attachAbsenceDocument } from "@/lib/absence-input";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const childIds = await getChildStudentIds(session);
  const requested = request.nextUrl.searchParams.get("studentId");
  const scoped = linkedStudentIdsOrForbidden(childIds, requested);
  if (!scoped.ok) {
    if (scoped.reason === "forbidden") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ requests: [] });
  }

  const requests = await prisma.studentAbsenceRequest.findMany({
    where: { studentId: { in: scoped.studentIds } },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  let fields: Record<string, unknown>;
  let file: File | null = null;
  try {
    const parsedBody = await parseAbsenceFields(request);
    fields = parsedBody.fields;
    file = parsedBody.file;
  } catch {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const parsed = parentStudentAbsenceSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const childIds = await getChildStudentIds(session);
  if (!childIds.includes(parsed.data.studentId)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId: session.schoolId ?? undefined },
    select: {
      id: true,
      schoolId: true,
      firstName: true,
      lastName: true,
      classId: true,
      userId: true,
    },
  });
  if (!student) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const denied = await requireLicenseWrite(student.schoolId, { feature: "student_leave" });
  if (denied) return denied;

  let documentUrl: string | null | undefined;
  try {
    documentUrl = await attachAbsenceDocument({
      schoolId: student.schoolId,
      ownerId: student.id,
      file,
      documentUrl: parsed.data.documentUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the supporting document";
    return NextResponse.json({ message }, { status: 400 });
  }

  const result = await createLearnerAbsenceRequest({
    schoolId: student.schoolId,
    student,
    type: parsed.data.type,
    fromDate: new Date(parsed.data.fromDate),
    toDate: new Date(parsed.data.toDate),
    reason: parsed.data.reason,
    documentUrl,
    source: "PARENT",
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}
