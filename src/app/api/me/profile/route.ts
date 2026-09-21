import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedLearner } from "@/lib/learner-scope";
import { maskIdentityNumber } from "@/lib/learner-portal";

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

export async function PATCH() {
  return NextResponse.json(
    { message: "Students can only change their password." },
    { status: 403 }
  );
}
