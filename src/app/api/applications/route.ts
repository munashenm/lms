import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { applicationSchema } from "@/lib/validators";
import { notifySchoolRoles } from "@/lib/notifications";
import { sendApplicationConfirmation } from "@/lib/application-notify";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const applications = await prisma.application.findMany({
    where: getSchoolFilter(session!),
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ applications });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => {
      errors[i.path[0]?.toString() ?? "form"] = i.message;
    });
    return NextResponse.json({ errors }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { slug: parsed.data.schoolSlug },
  });

  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  const count = await prisma.application.count({ where: { schoolId: school.id } });
  const referenceNo = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const application = await prisma.application.create({
    data: {
      schoolId: school.id,
      referenceNo,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      saIdNumber: parsed.data.saIdNumber || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      gradeApplied: parsed.data.gradeApplied || null,
      courseApplied: parsed.data.courseApplied || null,
      notes: parsed.data.notes || null,
    },
  });

  await notifySchoolRoles({
    schoolId: school.id,
    roles: [UserRole.ADMISSIONS_OFFICER, UserRole.SCHOOL_ADMIN],
    title: "New application",
    message: `${parsed.data.firstName} ${parsed.data.lastName} submitted application ${referenceNo}.`,
    type: "ADMISSION",
    link: "/admin/applications",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  await sendApplicationConfirmation({
    schoolId: school.id,
    referenceNo,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    schoolName: school.name,
    appUrl,
  });

  return NextResponse.json({ application, referenceNo }, { status: 201 });
}
