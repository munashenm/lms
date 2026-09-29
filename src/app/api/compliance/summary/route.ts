import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { checkEducatorEmis, checkLearnerEmis, summariseCompliance } from "@/lib/compliance/emis-fields";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) {
    return NextResponse.json({ message: "Select a school" }, { status: 400 });
  }

  const [learners, educators, school] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        status: true,
        saIdNumber: true,
        passportNumber: true,
        dateOfBirth: true,
        gender: true,
        populationGroup: true,
        citizenship: true,
        homeLanguage: true,
        preferredLanguage: true,
        disabilityStatus: true,
        sneStatus: true,
        luritsNumber: true,
        grade: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        status: true,
        saIdNumber: true,
        luritsNumber: true,
        persalNumber: true,
      },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        province: true,
        registrationNo: true,
        cemisEnabled: true,
      },
    }),
  ]);

  const issues = [
    ...learners.flatMap((l) =>
      checkLearnerEmis({
        ...l,
        gradeName: l.grade?.name,
        className: l.class?.name,
      })
    ),
    ...educators.flatMap((e) => checkEducatorEmis(e)),
  ];

  const summary = summariseCompliance(issues);
  return NextResponse.json({
    school,
    cemisEnabled: Boolean(school?.cemisEnabled),
    summary: {
      ...summary,
      activeLearners: learners.length,
      activeEducators: educators.length,
    },
    issues: issues.slice(0, 500),
  });
}