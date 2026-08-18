import { prisma } from "./db";

export async function getFeeEmailRecipient(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      guardians: {
        orderBy: { isPrimary: "desc" },
        take: 1,
        include: {
          guardian: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!student) return null;

  const guardian = student.guardians[0]?.guardian ?? null;
  return {
    student,
    guardian,
    toEmail: guardian?.email || student.email || null,
    recipientName: guardian
      ? `${guardian.firstName} ${guardian.lastName}`
      : "Parent/Guardian",
  };
}
