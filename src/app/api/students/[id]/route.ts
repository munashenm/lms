import { NextRequest, NextResponse } from "next/server";
import { Gender, StudentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { studentPatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { emptyToNull } from "@/lib/class-teachers";
import { recordStudentChanges } from "@/lib/student-history";
import {
  learnerPortalShouldBeActive,
  provisionExistingStudent,
  setLinkedUserActive,
} from "@/lib/portal-provision";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = await denyUnless(session, "students.edit");
  if (denied) return denied;
  const actor = session!;

  const { id } = await params;
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(actor, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = studentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const data = parsed.data;
  const fieldUpdate = {
    ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
    ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
    ...(data.middleName !== undefined ? { middleName: emptyToNull(data.middleName) } : {}),
    ...(data.preferredName !== undefined ? { preferredName: emptyToNull(data.preferredName) } : {}),
    ...(data.nationality !== undefined ? { nationality: emptyToNull(data.nationality) } : {}),
    ...(data.homeLanguage !== undefined ? { homeLanguage: emptyToNull(data.homeLanguage) } : {}),
    ...(data.saIdNumber !== undefined ? { saIdNumber: emptyToNull(data.saIdNumber) } : {}),
    ...(data.passportNumber !== undefined ? { passportNumber: emptyToNull(data.passportNumber) } : {}),
    ...(data.alternativeId !== undefined ? { alternativeId: emptyToNull(data.alternativeId) } : {}),
    ...(data.email !== undefined ? { email: emptyToNull(data.email) } : {}),
    ...(data.phone !== undefined ? { phone: emptyToNull(data.phone) } : {}),
    ...(data.dateOfBirth !== undefined
      ? { dateOfBirth: emptyToNull(data.dateOfBirth) ? new Date(data.dateOfBirth) : null }
      : {}),
    ...(data.gender !== undefined ? { gender: (emptyToNull(data.gender) as Gender | null) } : {}),
    ...(data.campusId !== undefined ? { campusId: emptyToNull(data.campusId) } : {}),
    ...(data.studentNumber !== undefined ? { studentNumber: data.studentNumber } : {}),
    ...(data.enrolledAt !== undefined
      ? { enrolledAt: emptyToNull(data.enrolledAt) ? new Date(data.enrolledAt) : null }
      : {}),
    ...(data.address !== undefined ? { address: emptyToNull(data.address) } : {}),
    ...(data.city !== undefined ? { city: emptyToNull(data.city) } : {}),
    ...(data.province !== undefined ? { province: emptyToNull(data.province) } : {}),
    ...(data.postalCode !== undefined ? { postalCode: emptyToNull(data.postalCode) } : {}),
    ...(data.postalAddress !== undefined ? { postalAddress: emptyToNull(data.postalAddress) } : {}),
    ...(data.medicalNotes !== undefined ? { medicalNotes: emptyToNull(data.medicalNotes) } : {}),
    ...(data.emergencyName !== undefined ? { emergencyName: emptyToNull(data.emergencyName) } : {}),
    ...(data.emergencyPhone !== undefined ? { emergencyPhone: emptyToNull(data.emergencyPhone) } : {}),
    ...(data.emergencyRelationship !== undefined
      ? { emergencyRelationship: emptyToNull(data.emergencyRelationship) }
      : {}),
    ...(data.notes !== undefined ? { notes: emptyToNull(data.notes) } : {}),
    ...(data.status !== undefined ? { status: data.status as StudentStatus } : {}),
  };

  const student =
    Object.keys(fieldUpdate).length > 0
      ? await prisma.student.update({ where: { id }, data: fieldUpdate })
      : existing;

  if (Object.keys(fieldUpdate).length > 0) {
    await recordStudentChanges({
      schoolId: existing.schoolId,
      studentId: id,
      userId: actor.userId,
      before: existing as unknown as Record<string, unknown>,
      after: student as unknown as Record<string, unknown>,
    });
  }

  if (student.userId && (data.firstName || data.lastName || data.phone !== undefined || data.email !== undefined)) {
    const userData: { firstName?: string; lastName?: string; phone?: string | null; email?: string } = {};
    if (data.firstName) userData.firstName = data.firstName;
    if (data.lastName) userData.lastName = data.lastName;
    if (data.phone !== undefined) userData.phone = student.phone;
    if (student.email) {
      const taken = await prisma.user.findFirst({
        where: { email: student.email, NOT: { id: student.userId } },
        select: { id: true },
      });
      if (!taken) userData.email = student.email;
    }
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: student.userId }, data: userData });
    }
  }

  if (data.status && data.status !== existing.status) {
    await setLinkedUserActive({
      userId: student.userId,
      schoolId: existing.schoolId,
      actorId: actor.userId,
      isActive: learnerPortalShouldBeActive(data.status),
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: actor.userId,
      action: "UPDATE",
      entity: "Student",
      entityId: id,
      metadata: { status: data.status },
    });
  } else if (Object.keys(fieldUpdate).length > 0) {
    await logAudit({
      schoolId: existing.schoolId,
      userId: actor.userId,
      action: "UPDATE",
      entity: "Student",
      entityId: id,
    });
  }

  let provision: { studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number } | null =
    null;
  if (data.invitePortal) {
    try {
      provision = await provisionExistingStudent({
        studentId: id,
        schoolId: existing.schoolId,
        actorId: actor.userId,
      });
    } catch {
      provision = { studentLoginCreated: false, guardianLinked: false, invitesSent: 0 };
    }
  }

  return NextResponse.json({ student, provision });
}
