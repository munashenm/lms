import { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { getChildStudentIds, getStudentForSession } from "@/lib/portal-data";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { resolveLinkedStudentId } from "@/lib/parent-scope";

export async function sessionCanAccessStudentCard(
  session: SessionPayload,
  studentId: string
): Promise<boolean> {
  if (session.role === UserRole.STUDENT) {
    const self = await getStudentForSession(session);
    return Boolean(self && self.id === studentId);
  }
  if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    return childIds.includes(studentId);
  }
  return hasPermission(session.role, "students:read");
}

export async function resolvePortalCardStudentId(
  session: SessionPayload,
  requestedId?: string | null
): Promise<{ ok: true; studentId: string } | { ok: false; status: number; message: string }> {
  if (session.role === UserRole.STUDENT) {
    const self = await getStudentForSession(session);
    if (!self) return { ok: false, status: 403, message: "Unauthorized" };
    if (requestedId && requestedId !== self.id) {
      return { ok: false, status: 403, message: "Unauthorized" };
    }
    return { ok: true, studentId: self.id };
  }

  if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (childIds.length === 0) {
      return { ok: false, status: 404, message: "No linked children" };
    }
    if (requestedId && !childIds.includes(requestedId)) {
      return { ok: false, status: 403, message: "Unauthorized" };
    }
    const studentId = resolveLinkedStudentId(childIds, requestedId);
    if (!studentId) {
      return { ok: false, status: 400, message: "Select a child to download the ID card." };
    }
    return { ok: true, studentId };
  }

  return { ok: false, status: 403, message: "Unauthorized" };
}

export async function buildStudentCardResponse(opts: {
  studentId: string;
  session: SessionPayload;
}) {
  const student = await prisma.student.findFirst({
    where: { id: opts.studentId, ...getSchoolFilter(opts.session) },
    include: {
      school: true,
      grade: { select: { name: true } },
      class: { select: { name: true } },
    },
  });
  if (!student) return null;

  const currentYear = await prisma.academicYear.findFirst({
    where: {
      schoolId: student.schoolId,
      OR: [{ isCurrent: true }, { status: "ACTIVE" }],
    },
    orderBy: { startDate: "desc" },
    select: { name: true },
  });

  const pdf = await generateStudentCardPdf({
    brand: toSchoolBrand(student.school),
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    gradeOrProgramme: student.grade?.name ?? null,
    className: student.class?.name ?? null,
    status: student.status,
    photoUrl: student.photoUrl,
    validYear: currentYear?.name ?? String(new Date().getFullYear()),
  });

  return { pdf, student };
}
