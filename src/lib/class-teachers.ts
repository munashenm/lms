import { prisma } from "./db";

export async function assignPrimaryClassTeacher(params: {
  classId: string;
  schoolId: string;
  teacherId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!params.teacherId) {
    await prisma.classTeacher.deleteMany({
      where: { classId: params.classId },
    });
    return { ok: true };
  }

  const teacher = await prisma.teacher.findFirst({
    where: { id: params.teacherId, schoolId: params.schoolId },
    select: { id: true },
  });
  if (!teacher) {
    return { ok: false, message: "Teacher not found" };
  }

  await prisma.classTeacher.deleteMany({
    where: { classId: params.classId, teacherId: { not: params.teacherId } },
  });
  await prisma.classTeacher.upsert({
    where: { classId_teacherId: { classId: params.classId, teacherId: params.teacherId } },
    create: { classId: params.classId, teacherId: params.teacherId, isPrimary: true },
    update: { isPrimary: true },
  });
  return { ok: true };
}

export function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
