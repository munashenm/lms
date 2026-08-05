import { prisma } from "./db";

/** Generate next school-unique student number: STD{year}{####} */
export async function generateStudentNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STD${year}`;

  const latest = await prisma.student.findFirst({
    where: {
      schoolId,
      studentNumber: { startsWith: prefix },
    },
    orderBy: { studentNumber: "desc" },
    select: { studentNumber: true },
  });

  let next = 1;
  if (latest?.studentNumber) {
    const suffix = latest.studentNumber.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  } else {
    const count = await prisma.student.count({ where: { schoolId } });
    next = count + 1;
  }

  let candidate = `${prefix}${String(next).padStart(4, "0")}`;
  // Guard against races / manual numbers colliding
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.student.findUnique({
      where: {
        schoolId_studentNumber: { schoolId, studentNumber: candidate },
      },
      select: { id: true },
    });
    if (!exists) return candidate;
    next += 1;
    candidate = `${prefix}${String(next).padStart(4, "0")}`;
  }

  return `${prefix}${String(Date.now()).slice(-6)}`;
}
