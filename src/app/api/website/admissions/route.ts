import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { websiteAdmissionsSchema } from "@/lib/validators";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write") && !requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const schoolId = resolveSettingsSchoolId(session!, body.schoolId ?? request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session, schoolId)) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const parsed = websiteAdmissionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.school.update({
      where: { id: schoolId },
      data: {
        applicationsOpen: data.applicationsOpen,
        applicationsOpenFrom: data.applicationsOpenFrom ? new Date(data.applicationsOpenFrom) : null,
        applicationsOpenUntil: data.applicationsOpenUntil ? new Date(data.applicationsOpenUntil) : null,
        admissionYearId: data.admissionYearId || null,
        applicationInstructions: data.applicationInstructions || null,
        requiredApplicationDocuments: data.requiredApplicationDocuments ?? [],
      },
    });
    if (data.gradeIds) {
      await tx.grade.updateMany({ where: { schoolId }, data: { openForApplications: false } });
      if (data.gradeIds.length) {
        await tx.grade.updateMany({
          where: { schoolId, id: { in: data.gradeIds } },
          data: { openForApplications: true },
        });
      }
    }
    if (data.courseIds) {
      await tx.course.updateMany({ where: { schoolId }, data: { openForApplications: false } });
      if (data.courseIds.length) {
        await tx.course.updateMany({
          where: { schoolId, id: { in: data.courseIds } },
          data: { openForApplications: true },
        });
      }
    }
  });

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { grades: true, courses: true, admissionYear: true },
  });
  return NextResponse.json({ school });
}
