import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, canAccessSchool } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { assessmentAccess, assessmentSchoolId } from "@/lib/tenant";
import { tenantMiss } from "@/lib/authorize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const access = await assessmentAccess(id);
  const schoolId = access ? assessmentSchoolId(access) : null;
  if (!access || !schoolId || !canAccessSchool(session!, schoolId)) {
    return tenantMiss();
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      subject: true,
      module: true,
      term: true,
      teacher: true,
      assignment: { include: { submissions: { include: { student: true } } } },
      marks: { include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } } },
    },
  });

  if (!assessment) {
    return tenantMiss();
  }

  return NextResponse.json({ assessment });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const access = await assessmentAccess(id);
  const schoolId = access ? assessmentSchoolId(access) : null;
  if (!access || !schoolId || !canAccessSchool(session!, schoolId)) {
    return tenantMiss();
  }

  const denied = await requireLicenseWrite(schoolId, { feature: "assessments" });
  if (denied) return denied;

  const body = await request.json();

  const assessment = await prisma.assessment.update({
    where: { id },
    data: {
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
    },
  });

  return NextResponse.json({ assessment });
}
