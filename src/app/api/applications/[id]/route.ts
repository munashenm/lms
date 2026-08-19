import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { applicationStatusSchema } from "@/lib/validators";
import { sendApplicationStatusUpdate } from "@/lib/application-notify";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import {
  enrolFromAcceptedApplication,
  findStudentForApplication,
  shouldCreateStudentOnAccept,
} from "@/lib/application-enrolment";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = applicationStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.application.findUnique({
    where: { id },
    include: { school: { select: { name: true } } },
  });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "admissions" });
  if (denied) return denied;

  let enrolled: { studentId: string; studentNumber: string; created: boolean } | null = null;
  if (shouldCreateStudentOnAccept({ nextStatus: parsed.data.status, studentId: existing.studentId })) {
    const linkedStudentId = await findStudentForApplication(existing);
    if (!linkedStudentId) {
      const guard = await licenseWriteGuard({
        schoolId: existing.schoolId,
        action: "create_learner",
      });
      if (!guard.ok) return licenseDeniedResponse(guard);
    }
    try {
      enrolled = await enrolFromAcceptedApplication({
        application: existing,
        existingStudentId: linkedStudentId,
        actorId: session.userId,
        hostel: parsed.data.hostel,
        transport: parsed.data.transport,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not enrol applicant" },
        { status: 400 }
      );
    }
  }

  const application = await prisma.application.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes ?? undefined,
      reviewedAt: new Date(),
      studentId: enrolled?.studentId ?? undefined,
    },
  });

  if (existing.status !== parsed.data.status) {
    await sendApplicationStatusUpdate({
      schoolId: existing.schoolId,
      email: existing.email,
      phone: existing.phone,
      firstName: existing.firstName,
      referenceNo: existing.referenceNo,
      status: APPLICATION_STATUS_LABELS[parsed.data.status] ?? parsed.data.status,
      schoolName: existing.school.name,
    });
  }

  return NextResponse.json({
    application,
    student: enrolled
      ? { id: enrolled.studentId, studentNumber: enrolled.studentNumber, created: enrolled.created }
      : null,
  });
}
