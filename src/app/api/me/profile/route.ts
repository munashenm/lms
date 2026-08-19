import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedLearner } from "@/lib/learner-scope";
import { learnerProfilePatchSchema } from "@/lib/validators";
import { maskIdentityNumber } from "@/lib/learner-portal";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

export async function GET() {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  return NextResponse.json({
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      studentNumber: student.studentNumber,
      photoUrl: student.photoUrl,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      saIdNumber: maskIdentityNumber(student.saIdNumber),
      email: student.email ?? student.user?.email ?? null,
      phone: student.phone,
      address: student.address,
      city: student.city,
      province: student.province,
      postalCode: student.postalCode,
      status: student.status,
      grade: student.grade,
      class: student.class,
      campus: student.campus,
      school: student.school,
      guardians: student.guardians,
      enrolments: student.enrolments,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  const student = await requireAuthenticatedLearner(session);
  if (!student) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const denied = await requireLicenseWrite(student.schoolId, { feature: "student_portal" });
  if (denied) return denied;

  const parsed = learnerProfilePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: {
      email: parsed.data.email || student.email,
      phone: parsed.data.phone ?? student.phone,
      address: parsed.data.address ?? student.address,
      city: parsed.data.city ?? student.city,
      province: parsed.data.province ?? student.province,
      postalCode: parsed.data.postalCode ?? student.postalCode,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
    },
  });

  return NextResponse.json({ student: updated });
}
